package room

import (
	"log"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"

	"github.com/Foodstream-io/etchebest/internal/hls"
	liveModule "github.com/Foodstream-io/etchebest/internal/modules/live"
	tagModule "github.com/Foodstream-io/etchebest/internal/modules/tag"
	userModule "github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pion/rtcp"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
	"gorm.io/gorm"
)

type Request struct {
	Name            string   `json:"name"`
	Title           string   `json:"title"`
	Description     string   `json:"description"`
	Tags            []string `json:"tags"`
	Level           string   `json:"level"`
	DurationMinutes int      `json:"durationMinutes"`
	Visibility      string   `json:"visibility"`
	ThumbnailURL    string   `json:"thumbnailUrl"`
	Status          string   `json:"status"`
	ScheduledAt     *string  `json:"scheduledAt"`
}

type AddParticipantReq struct {
	RoomId string `json:"roomId" binding:"required" example:"550e8400-e29b-41d4-a716-446655440000"`
	UserId string `json:"userId" binding:"required" example:"550e8400-e29b-41d4-a716-446655440001"`
}

var (
	mu        sync.Mutex
	liveRooms = make(map[string]*Room)
)

func normalizeFmtp(fmtp string) string {
	fmtp = strings.TrimSpace(strings.ToLower(fmtp))
	if fmtp == "" {
		return ""
	}
	parts := strings.Split(fmtp, ";")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	slices.Sort(parts)
	return strings.Join(parts, ";")
}

func h264IsCompatible(src, dst string) bool {
	src = normalizeFmtp(src)
	dst = normalizeFmtp(dst)
	if src == "" || dst == "" {
		return false
	}

	getParam := func(fmtp, key string) string {
		for _, part := range strings.Split(fmtp, ";") {
			kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
			if len(kv) != 2 {
				continue
			}
			if strings.TrimSpace(kv[0]) == key {
				return strings.TrimSpace(kv[1])
			}
		}
		return ""
	}

	return getParam(src, "packetization-mode") == getParam(dst, "packetization-mode") &&
		getParam(src, "profile-level-id") == getParam(dst, "profile-level-id")
}

func findCodec(
	pc *webrtc.PeerConnection,
	match func(codec webrtc.RTPCodecParameters) bool,
) (webrtc.RTPCodecCapability, uint8, bool) {
	for _, transceiver := range pc.GetTransceivers() {
		receiver := transceiver.Receiver()
		if receiver == nil {
			continue
		}
		params := receiver.GetParameters()
		for _, codec := range params.Codecs {
			if !match(codec) {
				continue
			}
			cap := webrtc.RTPCodecCapability{
				MimeType:    codec.MimeType,
				ClockRate:   codec.ClockRate,
				Channels:    codec.Channels,
				SDPFmtpLine: codec.SDPFmtpLine,
			}
			return cap, uint8(codec.PayloadType), true
		}
	}

	return webrtc.RTPCodecCapability{}, 0, false
}

// getLiveRoom returns the shared in-memory Room pointer.
// If not yet tracked, it loads from the DB and registers it.
func getLiveRoom(db *gorm.DB, id string) (*Room, error) {
	if r, ok := liveRooms[id]; ok {
		return r, nil
	}
	r, err := GetRoomById(db, id)
	if err != nil {
		return nil, err
	}
	liveRooms[id] = r
	return r, nil
}

func removeLiveRoom(id string) {
	delete(liveRooms, id)
}

func markLiveAsEndedByRoomID(db *gorm.DB, roomID string, replayURL string) {
	now := time.Now()

	updates := map[string]any{
		"status":   "ended",
		"ended_at": now,
	}

	if replayURL != "" {
		updates["has_replay"] = true
		updates["replay_url"] = replayURL
	}

	if err := db.Model(&liveModule.Live{}).
		Where("room_id = ? AND status != ?", roomID, "ended").
		Updates(updates).Error; err != nil {
		log.Printf("failed to mark live as ended for room %s: %v", roomID, err)
	}
	log.Printf("[LIVE END] room=%s updates=%+v", roomID, updates)
}

func getPeerConnectionByUser(room *Room, userID string) *webrtc.PeerConnection {
	for _, conn := range room.Connections {
		if conn.UserID == userID {
			return conn.PeerCon
		}
	}
	return nil
}

// requestRenegotiationOffer creates and queues a server offer for one user.
// The offer is fetched by the client via polling and answered through
// HandleRenegotiationAnswer.
func requestRenegotiationOffer(room *Room, userID string, pc *webrtc.PeerConnection) {
	if room == nil || pc == nil || userID == "" {
		return
	}

	mu.Lock()
	if room.PendingOfferByUser == nil {
		room.PendingOfferByUser = make(map[string]webrtc.SessionDescription)
	}
	if room.RenegotiatingByUser == nil {
		room.RenegotiatingByUser = make(map[string]bool)
	}
	if room.NeedsRenegotiationByUser == nil {
		room.NeedsRenegotiationByUser = make(map[string]bool)
	}

	if _, hasPendingOffer := room.PendingOfferByUser[userID]; hasPendingOffer {
		room.NeedsRenegotiationByUser[userID] = true
		mu.Unlock()
		return
	}
	if room.RenegotiatingByUser[userID] {
		room.NeedsRenegotiationByUser[userID] = true
		mu.Unlock()
		return
	}
	room.RenegotiatingByUser[userID] = true
	mu.Unlock()

	defer func() {
		mu.Lock()
		if room.RenegotiatingByUser != nil {
			room.RenegotiatingByUser[userID] = false
		}
		mu.Unlock()
	}()

	if pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
		return
	}
	if pc.SignalingState() != webrtc.SignalingStateStable {
		mu.Lock()
		if room.NeedsRenegotiationByUser != nil {
			room.NeedsRenegotiationByUser[userID] = true
		}
		mu.Unlock()
		return
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		log.Printf("CreateOffer (renegotiation) failed for user %s: %v", userID, err)
		mu.Lock()
		if room.NeedsRenegotiationByUser != nil {
			room.NeedsRenegotiationByUser[userID] = true
		}
		mu.Unlock()
		return
	}

	log.Printf("Generated renegotiation offer for user %s, has %d senders currently", userID, len(pc.GetSenders()))
	for i, sender := range pc.GetSenders() {
		if sender != nil && sender.Track() != nil {
			log.Printf("  Sender %d: %s track (id=%s)", i, sender.Track().Kind(), sender.Track().ID())
		}
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		log.Printf("SetLocalDescription (renegotiation) failed for user %s: %v", userID, err)
		mu.Lock()
		if room.NeedsRenegotiationByUser != nil {
			room.NeedsRenegotiationByUser[userID] = true
		}
		mu.Unlock()
		return
	}
	<-gatherComplete

	local := pc.LocalDescription()
	if local == nil {
		mu.Lock()
		if room.NeedsRenegotiationByUser != nil {
			room.NeedsRenegotiationByUser[userID] = true
		}
		mu.Unlock()
		return
	}

	mu.Lock()
	defer mu.Unlock()
	if getPeerConnectionByUser(room, userID) != pc {
		return
	}

	// Send offer via WebSocket if connection exists
	if !sendOfferToUser(room.ID, userID, local) {
		// Fallback to polling if WebSocket not available
		if room.PendingOfferByUser == nil {
			room.PendingOfferByUser = make(map[string]webrtc.SessionDescription)
		}
		room.PendingOfferByUser[userID] = *local
		log.Printf("WebSocket send failed for %s, storing offer for polling", userID)
	}
}

// closePeerConnection safely removes senders and closes the underlying PeerConnection.
// Extracted to reduce cognitive complexity in handlers.
func closePeerConnection(pc PeerConnection) {
	if pc.PeerCon == nil {
		return
	}
	// If already closed, nothing to do
	if pc.PeerCon.ConnectionState() == webrtc.PeerConnectionStateClosed {
		return
	}
	for _, sender := range pc.PeerCon.GetSenders() {
		if sender == nil {
			continue
		}
		if sender.Track() != nil {
			_ = pc.PeerCon.RemoveTrack(sender)
		}
	}
	if err := pc.PeerCon.Close(); err != nil {
		log.Printf("couldn't close connection tracker: %v", err)
	}
}

// resolveCodec picks the best matching RTPCodecCapability for a peer connection.
// Viewers are recvonly so their Sender has no codec params; we look at the
// Receiver parameters instead. Returns the capability and the negotiated PT.
// Falls back to a minimal capability with PT=0 so Pion can still create the track.
func resolveCodec(pc *webrtc.PeerConnection, mimeType string, fallback webrtc.RTPCodecCapability) (webrtc.RTPCodecCapability, uint8) {
	fallbackFmtp := normalizeFmtp(fallback.SDPFmtpLine)

	if cap, pt, ok := findCodec(pc, func(codec webrtc.RTPCodecParameters) bool {
		return strings.EqualFold(codec.MimeType, mimeType) && normalizeFmtp(codec.SDPFmtpLine) == fallbackFmtp
	}); ok {
		return cap, pt
	}

	if strings.EqualFold(mimeType, webrtc.MimeTypeH264) {
		if cap, pt, ok := findCodec(pc, func(codec webrtc.RTPCodecParameters) bool {
			return strings.EqualFold(codec.MimeType, mimeType) && h264IsCompatible(fallback.SDPFmtpLine, codec.SDPFmtpLine)
		}); ok {
			return cap, pt
		}
	}

	if cap, pt, ok := findCodec(pc, func(codec webrtc.RTPCodecParameters) bool {
		return strings.EqualFold(codec.MimeType, mimeType)
	}); ok {
		return cap, pt
	}

	return webrtc.RTPCodecCapability{MimeType: mimeType}, 0
}

// GetAllRooms godoc
// @Summary      Get all rooms
// @Description  Retrieve list of all streaming rooms
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Success      200  {array}   Room "rooms: list of rooms"
// @Failure      500  {object}  map[string]string "error: Failed to fetch rooms"
// @Security     BearerAuth
// @Router       /api/rooms [get]
func GetAllRooms(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rooms, err := GetRooms(db)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch rooms"})
			return
		}
		c.JSON(http.StatusOK, rooms)
	}
}

// CreateRoom godoc
// @Summary      Create or join a room
// @Description  Create a new streaming room or join existing one by name
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body Request true "Room details"
// @Success      200  {object}  map[string]interface{} "roomId and message (Room created or Room joined)"
// @Failure      400  {object}  map[string]string "error: Room name is required"
// @Failure      401  {object}  map[string]string "error: Unauthorized"
// @Failure      500  {object}  map[string]string "error: Failed to create room"
// @Router       /api/rooms [post]

func CreateNewRoom(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req Request
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room name is required"})
			return
		}

		currentUserId := utils.GetContextString(c, "userId")

		currentUser, err := userModule.GetUserByID(db, currentUserId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get current user"})
			return
		}

		var existingLive liveModule.Live

		if err := db.
			Where("user_id = ? AND status IN ?", currentUser.ID, []string{"live", "scheduled"}).
			First(&existingLive).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "you already have an active or scheduled live",
			})
			return
		}

		room := Room{
			ID:              uuid.New().String(),
			Name:            req.Name,
			Host:            currentUserId,
			Participants:    pq.StringArray{currentUserId},
			Viewers:         0,
			MaxParticipants: 6,
		}

		if err := CreateRoom(db, &room); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
			return
		}

		resolvedTags := make([]tagModule.Tag, 0, len(req.Tags))

		for _, tagName := range req.Tags {
			cleanName := strings.TrimSpace(tagName)
			if cleanName == "" {
				continue
			}

			slug := strings.ToLower(cleanName)
			slug = strings.ReplaceAll(slug, " ", "-")

			var existingTag tagModule.Tag
			if err := db.Where("slug = ?", slug).First(&existingTag).Error; err != nil {
				existingTag = tagModule.Tag{
					Name:     cleanName,
					Slug:     slug,
					IsActive: true,
				}

				if err := db.Create(&existingTag).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create tag"})
					return
				}
			}

			resolvedTags = append(resolvedTags, existingTag)
		}

		status := req.Status
		if status == "" {
			status = "scheduled"
		}

		dishName := ""
		if len(req.Tags) > 0 {
			dishName = req.Tags[0]
		}

		var scheduledAt *time.Time
		if req.ScheduledAt != nil && strings.TrimSpace(*req.ScheduledAt) != "" {
			parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.ScheduledAt))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid scheduledAt format"})
				return
			}
			scheduledAt = &parsed
		}

		var startedAt *time.Time
		if status == "live" {
			now := time.Now()
			startedAt = &now
		}

		title := strings.TrimSpace(req.Title)
		if title == "" {
			title = req.Name
		}

		newLive := liveModule.Live{
			RoomID:         room.ID,
			Title:          title,
			Description:    req.Description,
			DishName:       dishName,
			UserID:         currentUser.ID,
			Status:         status,
			ThumbnailURL:   req.ThumbnailURL,
			Duration:       req.DurationMinutes * 60,
			CurrentViewers: 0,
			ViewCount:      0,
			LikeCount:      0,
			StartedAt:      startedAt,
			Tags:           resolvedTags,
			ScheduledAt: scheduledAt,
		}

		if err := db.Create(&newLive).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create live"})
			return
		}

		mu.Lock()
		liveRooms[room.ID] = &room
		mu.Unlock()

		c.JSON(http.StatusOK, gin.H{
			"roomId":  room.ID,
			"liveId":  newLive.ID,
			"message": "room and live created",
		})
	}
}

// ReserveRoom godoc
// @Summary      Reserve a spot in a room
// @Description  Reserve a participant slot in a room in advance
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        roomId path string true "Room ID"
// @Success      200  {object}  map[string]string "message: reserved successfully, or you already reserved this room"
// @Failure      400  {object}  map[string]string "error: RoomID is required"
// @Failure      401  {object}  map[string]string "error: Unauthorized"
// @Failure      403  {object}  map[string]string "error: Room full, cannot reserve"
// @Failure      404  {object}  map[string]string "error: Room not found"
// @Failure      500  {object}  map[string]string "error: Failed to save reservation"
// @Router       /api/rooms/{roomId}/reserve [post]
func ReserveRoom(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomId := c.Param("roomId")

		room, err := GetRoomById(db, roomId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room " + roomId + " not found"})
			return
		}

		currentUserId := utils.GetContextString(c, "userId")
		for _, p := range room.Participants {
			if p == currentUserId {
				c.JSON(http.StatusOK, gin.H{"message": "you already reserved this room"})
				return
			}
		}

		if len(room.Participants) >= room.MaxParticipants {
			c.JSON(http.StatusForbidden, gin.H{"error": "room full, cannot reserve"})
			return
		}

		room.Participants = append(room.Participants, currentUserId)
		err = SaveRoom(db, room)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save reservation"})
			return
		}

		// Notify existing participants to renegotiate (so they can receive the new participant's stream)
		mu.Lock()
		liveRoom, getRoomErr := getLiveRoom(db, roomId)
		if getRoomErr == nil && liveRoom != nil {
			log.Printf("[RESERVE_ROOM] triggering renegotiation for new participant %s in room %s", currentUserId, roomId)
			for _, conn := range liveRoom.Connections {
				// Skip the new participant themselves
				if conn.UserID != currentUserId && conn.PeerCon != nil {
					go requestRenegotiationOffer(liveRoom, conn.UserID, conn.PeerCon)
				}
			}
		}
		mu.Unlock()

		c.JSON(http.StatusOK, gin.H{"message": "reserved successfully"})
	}
}

// AddParticipant godoc
// @Summary      Add participant to room
// @Description  Add a user as a participant to a specific room
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body AddParticipantReq true "Room and user IDs"
// @Success      200  {object}  map[string]string "status: Participant added or Already participant"
// @Failure      400  {object}  map[string]string "error: Invalid body"
// @Failure      401  {object}  map[string]string "error: Unauthorized"
// @Failure      404  {object}  map[string]string "error: Room not found"
// @Router       /api/rooms/participant [post]
func AddParticipant(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AddParticipantReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
			return
		}

		room, err := GetRoomById(db, req.RoomId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}

		if slices.Contains(room.Participants, req.UserId) {
			c.JSON(http.StatusOK, gin.H{"status": "already participant"})
			return
		}

		room.Participants = append(room.Participants, req.UserId)
		err = SaveRoom(db, room)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save reservation"})
			return
		}

		// Notify existing participants to renegotiate (so they can receive the new participant's stream)
		mu.Lock()
		liveRoom, getRoomErr := getLiveRoom(db, req.RoomId)
		if getRoomErr == nil && liveRoom != nil {
			log.Printf("[ADD_PARTICIPANT] triggering renegotiation for new participant %s in room %s", req.UserId, req.RoomId)
			for _, conn := range liveRoom.Connections {
				// Skip the new participant themselves
				if conn.UserID != req.UserId && conn.PeerCon != nil {
					go requestRenegotiationOffer(liveRoom, conn.UserID, conn.PeerCon)
				}
			}
		}
		mu.Unlock()

		c.JSON(http.StatusOK, gin.H{"status": "participant added"})
	}
}

// HandleDisconnect godoc
// @Summary      Disconnect from room
// @Description  Close all WebRTC connections and clean up room resources
// @Tags         webrtc
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        roomId path string true "Room ID"
// @Success      200  {object}  map[string]string "message: Disconnected successfully"
// @Failure      400  {object}  map[string]string "error: Room not found or already empty"
// @Failure      404  {object}  map[string]string "error: Room not found"
// @Router       /api/rooms/{roomId}/disconnect [post]
func HandleDisconnect(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomId := c.Param("roomId")
		currentUserID := utils.GetContextString(c, "userId")

		mu.Lock()
		room, err := getLiveRoom(db, roomId)
		if err != nil {
			mu.Unlock()
			c.JSON(http.StatusOK, gin.H{"message": "disconnected successfully"})
			return
		}

		if room.Host != currentUserID {
			mu.Unlock()
			c.JSON(http.StatusForbidden, gin.H{
				"error": "only the host can end this live",
			})
			return
		}

		// Snapshot connections so we can close them outside the lock
		conns := make([]PeerConnection, len(room.Connections))
		copy(conns, room.Connections)

		// Tear down room state
		replayURL, replayErr := hls.StopStream(roomId)
		log.Printf("[DISCONNECT] room=%s replayURL=%q replayErr=%v", roomId, replayURL, replayErr)
		if replayErr != nil {
			log.Printf("failed to generate replay for room %s: %v", roomId, replayErr)
		}
		room.Connections = nil
		room.Tracks = nil
		room.HostPeerCon = nil
		room.HLSWriter = nil
		removeLiveRoom(roomId)

		markLiveAsEndedByRoomID(db, roomId, replayURL)

		if err := DeleteRoomById(db, roomId); err != nil {
			log.Printf("HandleDisconnect: failed to delete room %s: %v", roomId, err)
		} else {
			log.Printf("HandleDisconnect: room %s deleted", roomId)
		}
		mu.Unlock()

		// Close peer connections outside the lock
		for _, pc := range conns {
			closePeerConnection(pc)
		}

		c.JSON(http.StatusOK, gin.H{"message": "disconnected successfully"})
	}
}

// HandleICECandidate godoc
// @Summary      Handle ICE candidates
// @Description  Add ICE candidates for WebRTC connection establishment
// @Tags         webrtc
// @Accept       json
// @Produce      json
// @Param        roomId query string true "Room ID"
// @Param        candidate body object true "ICE Candidate"
// @Success      200  {object}  map[string]string "status: Candidate added or Candidate buffered"
// @Failure      400  {object}  map[string]string "error: Room ID is required or Invalid ICE candidate format"
// @Failure      500  {object}  map[string]string "error: Failed to add ICE candidate"
// @Security     BearerAuth
// @Router       /api/ice [post]
func HandleICECandidate(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Query("roomId")
		if roomID == "" {
			log.Println("room ID missing")
			c.JSON(http.StatusBadRequest, gin.H{"error": "room ID is required"})
			return
		}

		var candidate webrtc.ICECandidateInit
		if err := c.ShouldBindJSON(&candidate); err != nil {
			log.Printf("failed to bind ICE candidate: %v\n", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ICE candidate format"})
			return
		}

		log.Printf("received ICE candidate for room %s: %s", roomID, candidate.Candidate)
		userID := utils.GetContextString(c, "userId")

		mu.Lock()
		defer mu.Unlock()

		room, err := getLiveRoom(db, roomID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}

		if room.PendingICEByUser == nil {
			room.PendingICEByUser = make(map[string][]webrtc.ICECandidateInit)
		}

		for _, pc := range room.Connections {
			if pc.UserID != userID {
				continue
			}
			if err := pc.PeerCon.AddICECandidate(candidate); err != nil {
				log.Printf("failed to add ICE candidate for user %s: %v", userID, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add ICE candidate"})
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "candidate added"})
			return
		}

		room.PendingICEByUser[userID] = append(room.PendingICEByUser[userID], candidate)
		log.Printf("no peer connection yet for user %s, buffered candidate (pending: %d)", userID, len(room.PendingICEByUser[userID]))
		c.JSON(http.StatusOK, gin.H{"status": "candidate buffered"})
	}
}

// PollRenegotiationOffer returns a pending server offer for the caller, if any.
func PollRenegotiationOffer(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Query("roomId")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room ID is required"})
			return
		}

		userID := utils.GetContextString(c, "userId")

		mu.Lock()
		room, err := getLiveRoom(db, roomID)
		if err != nil {
			mu.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}
		offer, ok := room.PendingOfferByUser[userID]
		mu.Unlock()

		if !ok {
			c.Status(http.StatusNoContent)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"type": offer.Type.String(),
			"sdp":  offer.SDP,
		})
	}
}

// HandleRenegotiationAnswer applies a client answer for a pending server offer.
func HandleRenegotiationAnswer(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Query("roomId")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room ID is required"})
			return
		}

		var answer webrtc.SessionDescription
		if err := c.ShouldBindJSON(&answer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid answer payload"})
			return
		}
		if answer.Type != webrtc.SDPTypeAnswer {
			c.JSON(http.StatusBadRequest, gin.H{"error": "expected SDP answer"})
			return
		}

		userID := utils.GetContextString(c, "userId")

		mu.Lock()
		room, err := getLiveRoom(db, roomID)
		if err != nil {
			mu.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}

		pc := getPeerConnectionByUser(room, userID)
		if pc == nil {
			mu.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": "peer connection not found"})
			return
		}

		mu.Unlock()

		if err := pc.SetRemoteDescription(answer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set remote description"})
			return
		}

		mu.Lock()
		if room.PendingOfferByUser != nil {
			delete(room.PendingOfferByUser, userID)
		}
		mu.Unlock()

		mu.Lock()
		needsAnotherOffer := room.NeedsRenegotiationByUser != nil && room.NeedsRenegotiationByUser[userID]
		if needsAnotherOffer {
			room.NeedsRenegotiationByUser[userID] = false
		}
		mu.Unlock()

		if needsAnotherOffer {
			go requestRenegotiationOffer(room, userID, pc)
		}

		c.JSON(http.StatusOK, gin.H{"status": "answer applied"})
	}
}

// ---------------------------------------------------------------------------
// HandleWebRTC helpers
// ---------------------------------------------------------------------------

// ensureParticipant checks if the user is already a participant; if not it
// auto-adds them when there is room. Returns an HTTP error and false when the
// caller should abort.
func ensureParticipant(c *gin.Context, db *gorm.DB, room *Room, userID string) bool {
	for _, p := range room.Participants {
		if p == userID {
			return true
		}
	}
	if len(room.Participants) >= room.MaxParticipants {
		c.JSON(http.StatusForbidden, gin.H{"error": "room is full"})
		return false
	}
	room.Participants = append(room.Participants, userID)
	if err := SaveRoom(db, room); err != nil {
		log.Printf("failed to save participant: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join room"})
		return false
	}
	return true
}

// newPeerConnection creates a fully configured webrtc.PeerConnection with
// STUN, NAT traversal, port range and default codecs.
func newPeerConnection(stunURL, webrtcIP string) (*webrtc.PeerConnection, error) {
	se := webrtc.SettingEngine{}
	if webrtcIP != "" {
		se.SetNAT1To1IPs([]string{webrtcIP}, webrtc.ICECandidateTypeHost)
	}
	se.SetEphemeralUDPPortRange(50000, 50100)

	me := &webrtc.MediaEngine{}
	if err := me.RegisterDefaultCodecs(); err != nil {
		return nil, err
	}

	api := webrtc.NewAPI(
		webrtc.WithSettingEngine(se),
		webrtc.WithMediaEngine(me),
	)
	return api.NewPeerConnection(webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{{URLs: []string{stunURL}}},
	})
}

// registerPeer adds the PeerConnection to the room, marks the host, and
// returns any buffered ICE candidates for this user that should be flushed later.
// Must be called with mu held.
func registerPeer(pc *webrtc.PeerConnection, room *Room, userID string) []webrtc.ICECandidateInit {
	if room.HostPeerCon == nil && userID == room.Host {
		room.HostPeerCon = pc
	}
	room.Connections = append(room.Connections, PeerConnection{UserID: userID, PeerCon: pc})

	if room.PendingICEByUser == nil {
		return nil
	}

	pending := make([]webrtc.ICECandidateInit, len(room.PendingICEByUser[userID]))
	copy(pending, room.PendingICEByUser[userID])
	delete(room.PendingICEByUser, userID)
	return pending
}

// buildCodecInfo converts a webrtc.RTPCodecParameters into an hls.CodecInfo.
func buildCodecInfo(codec webrtc.RTPCodecParameters) *hls.CodecInfo {
	ci := &hls.CodecInfo{
		PayloadType: uint8(codec.PayloadType),
		ClockRate:   codec.ClockRate,
		Channels:    codec.Channels,
		FmtpLine:    codec.SDPFmtpLine,
	}
	if i := strings.LastIndex(codec.MimeType, "/"); i >= 0 {
		ci.CodecName = codec.MimeType[i+1:]
	} else {
		ci.CodecName = codec.MimeType
	}
	return ci
}

func attachExistingTracks(pc *webrtc.PeerConnection, room *Room) {
	for _, ti := range room.Tracks {
		if ti.LocalTracks == nil {
			ti.LocalTracks = make(map[*webrtc.PeerConnection]*webrtc.TrackLocalStaticRTP)
		}
		if ti.PeerPT == nil {
			ti.PeerPT = make(map[*webrtc.PeerConnection]uint8)
		}
		if ti.SendersByPeer == nil {
			ti.SendersByPeer = make(map[*webrtc.PeerConnection]*webrtc.RTPSender)
		}
		cap, pt := resolveCodec(pc, ti.Track.Codec().MimeType, ti.Track.Codec().RTPCodecCapability)
		lt, err := webrtc.NewTrackLocalStaticRTP(cap, ti.Track.ID()+"-"+uuid.New().String(), ti.Track.StreamID())
		if err != nil {
			log.Printf("attachExistingTracks: create local track: %v", err)
			continue
		}
		sender, err := pc.AddTrack(lt)
		if err != nil {
			log.Printf("attachExistingTracks: add track: %v", err)
			continue
		}
		startRTCPDrain(sender)
		ti.LocalTracks[pc] = lt
		ti.PeerPT[pc] = pt
		ti.SendersByPeer[pc] = sender
		ti.Senders = append(ti.Senders, sender)

		// Request a keyframe immediately so this new peer can decode the video
		if ti.Track.Kind() == webrtc.RTPCodecTypeVideo && ti.SourcePC != nil {
			_ = ti.SourcePC.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{
				MediaSSRC: uint32(ti.Track.SSRC()),
			}})
		}
	}
}

func startRTCPDrain(sender *webrtc.RTPSender) {
	if sender == nil {
		return
	}
	go func() {
		rtcpBuf := make([]byte, 1500)
		for {
			if _, _, err := sender.Read(rtcpBuf); err != nil {
				return
			}
		}
	}()
}

// hlsState holds per-handler state for lazy HLS initialisation inside OnTrack.
type hlsState struct {
	audio      *hls.CodecInfo
	video      *hls.CodecInfo
	trackCount int
}

// tryStartHLS starts the HLS pipeline once both audio and video tracks have
// been received. Must be called with mu held.
func (h *hlsState) tryStartHLS(room *Room, roomID string) {
	if h.trackCount < 2 || room.HLSWriter != nil || hls.IsRunning(roomID) {
		return
	}
	if h.video == nil {
		return
	}
	if !strings.EqualFold(h.video.CodecName, "h264") {
		log.Printf("[HLS] skip start for room %s: codec %s (WebRTC relay stays prioritized)", roomID, h.video.CodecName)
		return
	}
	// log.Println("starting HLS stream for room", roomID)
	log.Println("starting HLS stream for room", roomID)
	writer, _, err := hls.Start(roomID, h.audio, h.video)
	if err != nil {
		log.Printf("failed to start HLS: %v", err)
		return
	}
	room.HLSWriter = writer
}

// broadcastTrackToPeers creates per-peer LocalTracks for a newly received
// source track and registers them in the TrackInfo.
// Must be called with mu held.
type renegotiationTarget struct {
	userID string
	pc     *webrtc.PeerConnection
}

func broadcastTrackToPeers(ti *TrackInfo, room *Room, sourcePc *webrtc.PeerConnection) []renegotiationTarget {
	targetByUser := make(map[string]*webrtc.PeerConnection)

	// Initialize SendersByPeer if not already done
	if ti.SendersByPeer == nil {
		ti.SendersByPeer = make(map[*webrtc.PeerConnection]*webrtc.RTPSender)
	}

	for _, other := range room.Connections {
		if other.PeerCon == sourcePc {
			continue
		}

		cap, pt := resolveCodec(other.PeerCon, ti.Track.Codec().MimeType, ti.Track.Codec().RTPCodecCapability)

		lt, err := webrtc.NewTrackLocalStaticRTP(cap, ti.Track.ID()+"-"+uuid.NewString(), ti.Track.StreamID())
		if err != nil {
			log.Printf("broadcastTrackToPeers: create track: %v", err)
			continue
		}

		sender, err := other.PeerCon.AddTrack(lt)
		if err != nil {
			log.Printf("broadcastTrackToPeers: add track to peer: %v", err)
			continue
		}
		startRTCPDrain(sender)

		if ti.Track.Kind() == webrtc.RTPCodecTypeVideo {
			requestKeyframeBurst(sourcePc, uint32(ti.Track.SSRC()))
		}

		ti.LocalTracks[other.PeerCon] = lt
		ti.PeerPT[other.PeerCon] = pt
		ti.SendersByPeer[other.PeerCon] = sender
		ti.Senders = append(ti.Senders, sender)
		targetByUser[other.UserID] = other.PeerCon
	}

	targets := make([]renegotiationTarget, 0, len(targetByUser))
	for userID, pc := range targetByUser {
		targets = append(targets, renegotiationTarget{userID: userID, pc: pc})
	}

	return targets
}

func requestKeyframeBurst(pc *webrtc.PeerConnection, ssrc uint32) {
	if pc == nil || ssrc == 0 {
		return
	}
	go func() {
		// Request keyframes aggressively: 10 attempts, short delays
		// to maximize chances of receiving H.264 SPS/PPS at FFmpeg
		for i := 0; i < 10; i++ {
			_ = pc.WriteRTCP([]rtcp.Packet{
				&rtcp.PictureLossIndication{MediaSSRC: ssrc},
				&rtcp.FullIntraRequest{MediaSSRC: ssrc},
			})
			time.Sleep(350 * time.Millisecond)
		}
	}()
}

// peerTrack pairs a LocalTrack with the payload type to stamp on outgoing packets.
type peerTrack struct {
	lt *webrtc.TrackLocalStaticRTP
	pt uint8
}

// isH264Keyframe returns true if the H264 RTP payload starts an IDR (keyframe) NAL.
// It handles single NAL units, STAP-A aggregations, and FU-A fragments.
func isH264Keyframe(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}
	nalType := payload[0] & 0x1F
	switch nalType {
	case 5: // IDR slice — single NAL keyframe
		return true
	case 24: // STAP-A — scan aggregated NALs
		offset := 1
		for offset+2 <= len(payload) {
			size := int(payload[offset])<<8 | int(payload[offset+1])
			offset += 2
			if offset+size > len(payload) {
				break
			}
			if size > 0 && payload[offset]&0x1F == 5 {
				return true
			}
			offset += size
		}
	case 28, 29: // FU-A / FU-B — fragmented NAL
		if len(payload) < 2 {
			return false
		}
		// Start bit must be set (first fragment) and inner NAL type must be IDR.
		return payload[1]&0x80 != 0 && payload[1]&0x1F == 5
	}
	return false
}

// isVP8Keyframe parses a VP8 RTP payload (RFC 7741) and returns true if the
// payload carries the first packet of a VP8 keyframe (intra-coded frame).
func isVP8Keyframe(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}
	offset := 0
	desc0 := payload[offset]
	offset++

	// S=1 and PartID=0 means start of partition 0.
	if desc0&0x10 == 0 || desc0&0x0F != 0 {
		return false
	}

	// Extended VP8 descriptor present (X bit).
	if desc0&0x80 != 0 {
		if offset >= len(payload) {
			return false
		}
		xByte := payload[offset]
		offset++
		// PictureID (I bit)
		if xByte&0x80 != 0 {
			if offset >= len(payload) {
				return false
			}
			if payload[offset]&0x80 != 0 {
				offset += 2 // 2-byte PictureID
			} else {
				offset++ // 1-byte PictureID
			}
		}
		// TL0PICIDX (L bit)
		if xByte&0x40 != 0 {
			offset++
		}
		// TID/KEYIDX (T or K bit)
		if xByte&0x20 != 0 || xByte&0x10 != 0 {
			offset++
		}
	}

	if offset >= len(payload) {
		return false
	}
	// VP8 frame tag byte 0: bit 0 = 0 means keyframe.
	return payload[offset]&0x01 == 0
}

// isH264KeyframeWithParams checks if an H264 RTP payload contains SPS/PPS or IDR frame.
// H264 NAL unit types: 1=non-IDR, 5=IDR, 7=SPS, 8=PPS
// For HLS, we need at least an IDR frame to start encoding.
func isH264KeyframeWithParams(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}

	// H264 RTP payload format (RFC 3984):
	// Byte 0: F(1) | NRI(2) | Type(5)
	nalType := payload[0] & 0x1f

	// Single NAL unit packet - check for IDR (5), SPS (7), or PPS (8)
	if nalType > 0 && nalType < 24 {
		return nalType == 5 || nalType == 7 || nalType == 8
	}

	// STAP-A aggregated packet (type 24) - may contain SPS/PPS
	if nalType == 24 && len(payload) > 2 {
		return true
	}

	// FU-A fragmented mode (type 28)
	if nalType == 28 && len(payload) > 1 {
		fragStart := payload[1]&0x80 != 0
		if fragStart {
			fragType := payload[1] & 0x1f
			return fragType == 5 || fragType == 7 || fragType == 8
		}
	}

	return false
}

// isH264CodecParams checks if an H264 RTP payload contains codec parameters only (SPS/PPS).
// These must always be forwarded to FFmpeg, even if the slice-data gate is closed.
// H264 NAL unit types: 7=SPS, 8=PPS, 24=STAP-A (aggregated)
func isH264CodecParams(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}

	nalType := payload[0] & 0x1f

	// Single NAL unit - SPS or PPS
	if nalType == 7 || nalType == 8 {
		return true
	}

	// STAP-A aggregated packet (type 24) - may contain multiple NAL units including SPS/PPS
	if nalType == 24 && len(payload) > 2 {
		return true
	}

	return false
}

// extractAndSendAllSTAPAUnits takes a STAP-A packet and sends each NAL unit
// as a separate RTP packet to FFmpeg. Returns true if any units were sent.
func extractAndSendAllSTAPAUnits(payload []byte, writer net.Conn, originalPkt *rtp.Packet, seqNum *uint16) bool {
	if len(payload) < 1 {
		return false
	}

	nalType := payload[0] & 0x1f
	if nalType != 24 { // Not STAP-A
		return false
	}

	if len(payload) <= 2 {
		return false
	}

	sentAny := false
	units := []struct {
		offset int
		size   int
	}{}

	// Collect all NAL units in the STAP-A
	offset := 1
	for offset < len(payload)-1 {
		size := (int(payload[offset]) << 8) | int(payload[offset+1])
		offset += 2
		if offset+size > len(payload) {
			break
		}
		if size > 0 {
			units = append(units, struct {
				offset int
				size   int
			}{offset, size})
		}
		offset += size
	}

	// Send each unit with CONSECUTIVE sequence numbers to ensure RTP ordering.
	// This forces FFmpeg to process NAL units (SPS, PPS, slice) in the correct order,
	// preventing "non-existing PPS 0 referenced" errors. Only last unit has marker bit.
	for i, unit := range units {
		newPkt := *originalPkt
		newPkt.Payload = make([]byte, unit.size)
		copy(newPkt.Payload, payload[unit.offset:unit.offset+unit.size])

		// Assign consecutive sequence numbers using the monotonic seqNum
		newPkt.SequenceNumber = *seqNum
		*seqNum++
		newPkt.Marker = (i == len(units)-1)

		// Marshal and send
		data, err := newPkt.Marshal()
		if err == nil && writer != nil {
			_, _ = writer.Write(data)
			sentAny = true
		}
	}

	return sentAny
}

// isH264SPS checks if payload is an SPS (Sequence Parameter Set) NAL unit (type 7)
// Also checks inside STAP-A packets (type 24) which may contain aggregated SPS/PPS
func isH264SPS(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}
	nalType := payload[0] & 0x1f

	// Direct SPS
	if nalType == 7 {
		return true
	}

	// STAP-A aggregated packet - parse to find type 7 SPS
	if nalType == 24 && len(payload) > 2 {
		offset := 1
		for offset < len(payload)-1 {
			size := (int(payload[offset]) << 8) | int(payload[offset+1])
			offset += 2
			if offset+size > len(payload) {
				break
			}
			if size > 0 && (payload[offset]&0x1f) == 7 {
				return true
			}
			offset += size
		}
	}
	return false
}

// isH264PPS checks if payload is a PPS (Picture Parameter Set) NAL unit (type 8)
// Also checks inside STAP-A packets (type 24) which may contain aggregated SPS/PPS
func isH264PPS(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}
	nalType := payload[0] & 0x1f

	// Direct PPS
	if nalType == 8 {
		return true
	}

	// STAP-A aggregated packet - parse to find type 8 PPS
	if nalType == 24 && len(payload) > 2 {
		offset := 1
		for offset < len(payload)-1 {
			size := (int(payload[offset]) << 8) | int(payload[offset+1])
			offset += 2
			if offset+size > len(payload) {
				break
			}
			if size > 0 && (payload[offset]&0x1f) == 8 {
				return true
			}
			offset += size
		}
	}
	return false
}

// isH264SliceData checks if payload is slice data (types 1, 5) that requires params
func isH264SliceData(payload []byte) bool {
	if len(payload) < 1 {
		return false
	}
	nalType := payload[0] & 0x1f
	return nalType == 1 || nalType == 5 // NAL type 1=non-IDR, 5=IDR
}

// startTrackRelay reads RTP packets from the source track and fans them out to
// every subscribed peer (rewriting the PT) and, when isHLSSource is true,
// to FFmpeg for HLS. Only the host's relay goroutine should set isHLSSource;
// all other goroutines must leave it false so they never touch the shared HLSWriter.
func startTrackRelay(track *webrtc.TrackRemote, ti *TrackInfo, room *Room, pc *webrtc.PeerConnection, isHLSSource bool) {
	buf := make([]byte, 4096)
	var cachedWriter *hls.HLSWriter
	var cachedPeers []peerTrack
	pktCount := 0
	isAudio := track.Kind() == webrtc.RTPCodecTypeAudio
	hlsGotKeyframe := false
	pliLastPkt := 0
	hlsKeyframeTime := time.Time{}       // Track when first video keyframe arrived
	pliSentCount := 0                    // Count PLI requests sent during startup gate
	hlsReceivedSPS := false              // Track if we've received and forwarded SPS
	hlsReceivedPPS := false              // Track if we've received and forwarded PPS
	hlsParamsGateOpenTime := time.Time{} // Time when we started waiting for params
	var ffmpegVideoSeqNum uint16 = 0

	// Request a keyframe immediately so that both HLS and all WebRTC
	// receiving peers get a clean start for the video feed.
	if !isAudio {
		requestKeyframeBurst(pc, uint32(track.SSRC()))
	}

	for {
		n, _, err := track.Read(buf)
		if err != nil {
			log.Println("track ended:", err)
			return
		}

		var pkt rtp.Packet
		if err := pkt.Unmarshal(buf[:n]); err != nil {
			log.Printf("failed to unmarshal RTP: %v", err)
			continue
		}
		origPT := pkt.PayloadType
		pktCount++

		// Ignore retransmission/non-primary video packets for peer fanout.
		// Reinjecting RTX payload as media causes decoder corruption on receivers
		// (symptom: briefly unmuted, then permanently muted/black).
		if !isAudio && origPT != uint8(track.Codec().PayloadType) {
			continue
		}

		// Refresh the peer snapshot every ~100 packets to reduce lock contention.
		// Also refresh immediately on the first packet.
		if pktCount%100 == 1 {
			mu.Lock()
			cachedPeers = make([]peerTrack, 0, len(ti.LocalTracks))
			for pc, lt := range ti.LocalTracks {
				pt := ti.PeerPT[pc]
				if pt == 0 {
					pt = origPT
				}
				cachedPeers = append(cachedPeers, peerTrack{lt, pt})
			}
			cachedWriter = room.HLSWriter
			mu.Unlock()
		}

		// Fan-out with per-peer PT rewriting. Different peers may negotiate
		// different payload types for the same codec (e.g. VP8 PT=96 vs PT=98).
		for _, p := range cachedPeers {
			pktCopy := pkt
			pktCopy.PayloadType = p.pt
			if err := p.lt.WriteRTP(&pktCopy); err != nil {
				// peer track may have been removed — will be caught on next refresh
			}
		}

		// Feed FFmpeg for HLS — only from the designated host relay goroutine.
		if !isHLSSource || cachedWriter == nil {
			continue
		}

		if isAudio && cachedWriter.AudioConn != nil {
			_, _ = cachedWriter.AudioConn.Write(buf[:n])
		} else if !isAudio && cachedWriter.VideoConn != nil {
			// Skip RTX retransmission packets (different PT, 2-byte OSN header).
			if origPT != uint8(track.Codec().PayloadType) {
				continue
			}
			mimeType := strings.ToLower(track.Codec().MimeType)

			// Request periodic keyframes to recover faster after packet loss.
			if pktCount-pliLastPkt >= 150 {
				pliLastPkt = pktCount
				_ = pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{
					MediaSSRC: uint32(track.SSRC()),
				}})
			}

			// H264-specific: Gate that ensures SPS and PPS arrive at FFmpeg BEFORE any slice data.
			// This prevents "non-existing PPS 0 referenced" errors.
			//
			// Strategy:
			// 1. When we detect a keyframe (IDR), send PLI bursts to request SPS/PPS from sender
			// 2. ALWAYS forward SPS/PPS immediately when received
			// 3. HOLD slice data (types 1, 5) until we've seen both SPS and PPS
			// 4. Once both params are received, open the gate and forward everything
			if strings.Contains(mimeType, "h264") {
				isSPS := isH264SPS(pkt.Payload)
				isPPS := isH264PPS(pkt.Payload)
				isSlice := isH264SliceData(pkt.Payload)

				// Log codec params when detected (for debugging gate)
				if (isSPS || isPPS) && len(pkt.Payload) > 0 {
					nalType := pkt.Payload[0] & 0x1f
					log.Printf("[HLS] Codec param detected: type=%d SPS=%v PPS=%v", nalType, isSPS, isPPS)
				}

				// Update param tracking when we receive them
				if isSPS && !hlsReceivedSPS {
					hlsReceivedSPS = true
					log.Printf("[HLS] SPS received for room, starting params gate window")
					if hlsParamsGateOpenTime.IsZero() {
						hlsParamsGateOpenTime = time.Now()
					}
				}
				if isPPS && !hlsReceivedPPS {
					hlsReceivedPPS = true
					log.Printf("[HLS] PPS received for room")
					if hlsParamsGateOpenTime.IsZero() {
						hlsParamsGateOpenTime = time.Now()
					}
				}

				// When we see a keyframe and haven't started the gate yet, request params
				isKF := isH264KeyframeWithParams(pkt.Payload)
				if isKF && hlsKeyframeTime.IsZero() {
					hlsKeyframeTime = time.Now()
					hlsParamsGateOpenTime = time.Now()
					log.Printf("[HLS] keyframe detected for room, requesting codec params with PLI burst")
					// Send aggressive burst of PLI to force params resend
					for i := 0; i < 5; i++ {
						err := pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{
							MediaSSRC: uint32(track.SSRC()),
						}})
						if err != nil {
							log.Printf("[HLS] failed to send PLI: %v", err)
						}
						pliSentCount++
					}
				}

				// Periodic PLI every 150ms during first 2 seconds if we still haven't got params
				if !hlsParamsGateOpenTime.IsZero() && (!hlsReceivedSPS || !hlsReceivedPPS) {
					elapsed := time.Since(hlsParamsGateOpenTime)
					if elapsed > 0 && int(elapsed.Milliseconds())%150 == 0 && pliSentCount < 15 {
						err := pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{
							MediaSSRC: uint32(track.SSRC()),
						}})
						if err == nil {
							pliSentCount++
						}
					}
					// Fallback: if 2 seconds elapsed without params, open gate anyway
					if elapsed >= 2000*time.Millisecond && !hlsGotKeyframe {
						hlsGotKeyframe = true
						log.Printf("[HLS] timeout on params gate (waited 2s, SPS=%v PPS=%v), opening gate anyway",
							hlsReceivedSPS, hlsReceivedPPS)
					}
				}

				// Once we have both SPS and PPS, mark gate as open
				if hlsReceivedSPS && hlsReceivedPPS && !hlsGotKeyframe {
					hlsGotKeyframe = true
					elapsed := time.Since(hlsParamsGateOpenTime)
					log.Printf("[HLS] codec params ready for room (SPS+PPS received in %dms), sent %d PLI requests, starting video stream",
						elapsed.Milliseconds(), pliSentCount)
				}

				// Gate logic:
				// - ALWAYS forward SPS/PPS (they have params in them)
				// - Only forward slice data if gate is open OR we have both params
				if isSlice && !hlsGotKeyframe {
					// Skip slice data until we have both SPS and PPS
					continue
				}
			} else {
				// For VP8 or other codecs, simpler logic: just wait for first keyframe
				var isKF bool
				if strings.Contains(mimeType, "vp8") {
					isKF = isVP8Keyframe(pkt.Payload)
				} else {
					isKF = true // default
				}

				if isKF && hlsKeyframeTime.IsZero() {
					hlsKeyframeTime = time.Now()
					hlsGotKeyframe = true
					log.Printf("[HLS] keyframe detected for room (codec=%s), video feed started", track.Codec().MimeType)
				}

				if !hlsGotKeyframe {
					continue // hold all video until first keyframe
				}
			}

			// If this is a STAP-A with multiple NAL units, extract and send each one separately
			// This ensures FFmpeg receives individual NAL units, not an aggregated packet
			if strings.Contains(mimeType, "h264") && len(pkt.Payload) > 0 {
				nalType := pkt.Payload[0] & 0x1f
				if nalType == 24 { // STAP-A - deserialize into separate RTP packets
					if extractAndSendAllSTAPAUnits(pkt.Payload, cachedWriter.VideoConn, &pkt, &ffmpegVideoSeqNum) {
						log.Printf("[HLS] Deserialized STAP-A packet (skipping aggregated form)")
						// Successfully extracted and sent all units - skip the original STAP-A
						continue
					}
				}
			}

			// Send the packet (single NAL unit packets, or STAP-A if extraction failed)
			pkt.SequenceNumber = ffmpegVideoSeqNum
			ffmpegVideoSeqNum++
			data, err := pkt.Marshal()
			if err == nil {
				_, _ = cachedWriter.VideoConn.Write(data)
			}
		}
	}
}

// onPeerDisconnected cleans up room state when a peer leaves.
// It is safe to call multiple times for the same PC (idempotent).
func onPeerDisconnected(db *gorm.DB, room *Room, roomID string, pc *webrtc.PeerConnection) {
	mu.Lock()

	// Guard: if this PC is not in the connection list, it was already cleaned up.
	found := false
	disconnectedUserID := ""
	updated := make([]PeerConnection, 0, len(room.Connections))
	for _, c := range room.Connections {
		if c.PeerCon == pc {
			found = true
			disconnectedUserID = c.UserID
		} else {
			updated = append(updated, c)
		}
	}
	if !found {
		mu.Unlock()
		return // already cleaned up by a previous state-change event
	}

	log.Printf("peer disconnected from room %s", roomID)
	room.Connections = updated
	if disconnectedUserID != "" {
		// Remove participant from the participants list
		updatedParticipants := make(pq.StringArray, 0, len(room.Participants))
		for _, p := range room.Participants {
			if p != disconnectedUserID {
				updatedParticipants = append(updatedParticipants, p)
			}
		}
		room.Participants = updatedParticipants

		// Save the updated participants list to the database
		if err := SaveRoom(db, room); err != nil {
			log.Printf("failed to save room after removing participant: %v", err)
		}

		if room.PendingICEByUser != nil {
			delete(room.PendingICEByUser, disconnectedUserID)
		}
		if room.PendingOfferByUser != nil {
			delete(room.PendingOfferByUser, disconnectedUserID)
		}
		if room.RenegotiatingByUser != nil {
			delete(room.RenegotiatingByUser, disconnectedUserID)
		}
		if room.NeedsRenegotiationByUser != nil {
			delete(room.NeedsRenegotiationByUser, disconnectedUserID)
		}
	}

	// Clear the host pointer if this was the publisher
	if room.HostPeerCon == pc {
		room.HostPeerCon = nil
	}

	// Remove per-peer LocalTracks for the disconnecting peer AND remove TrackInfos sourced from this peer
	updatedTracks := make([]*TrackInfo, 0, len(room.Tracks))
	for _, ti := range room.Tracks {
		// If this track came from the disconnecting peer, remove it completely
		// and also remove the senders from all other peers
		if ti.SourcePC == pc {
			// Remove senders from all peers that were receiving this track
			if ti.SendersByPeer != nil {
				log.Printf("Removing track from %d receiving peers", len(ti.SendersByPeer))
				for otherPc, sender := range ti.SendersByPeer {
					if otherPc != nil && sender != nil {
						err := otherPc.RemoveTrack(sender)
						if err != nil {
							log.Printf("RemoveTrack failed: %v", err)
						} else {
							log.Printf("RemoveTrack succeeded for peer")
						}
					}
				}
			}
			log.Printf("Skipping track from disconnected peer (track will be removed from room)")
			continue
		}

		// Otherwise, remove this peer's LocalTrack from the track (if any)
		if ti.LocalTracks != nil {
			delete(ti.LocalTracks, pc)
		}
		if ti.PeerPT != nil {
			delete(ti.PeerPT, pc)
		}
		if ti.SendersByPeer != nil {
			delete(ti.SendersByPeer, pc)
		}
		updatedTracks = append(updatedTracks, ti)
	}
	room.Tracks = updatedTracks
	log.Printf("After cleanup: room has %d tracks", len(room.Tracks))

	// Prepare renegotiation targets for remaining peers
	var renegotiationTargets []renegotiationTarget
	for _, conn := range room.Connections {
		if conn.PeerCon != nil {
			renegotiationTargets = append(renegotiationTargets, renegotiationTarget{
				userID: conn.UserID,
				pc:     conn.PeerCon,
			})
		}
	}

	empty := len(room.Connections) == 0
	if empty {
		replayURL, replayErr := hls.StopStream(roomID)
		if replayErr != nil {
			log.Printf("failed to generate replay for room %s: %v", roomID, replayErr)
		}
		room.Tracks = nil
		removeLiveRoom(roomID)

		markLiveAsEndedByRoomID(db, roomID, replayURL)

		if err := DeleteRoomById(db, roomID); err != nil {
			log.Printf("failed to delete room %s: %v", roomID, err)
		} else {
			log.Printf("room %s deleted (last peer left)", roomID)
		}
	}
	mu.Unlock()

	// Trigger renegotiation for remaining peers outside the lock
	for _, target := range renegotiationTargets {
		go requestRenegotiationOffer(room, target.userID, target.pc)
	}

	// Close the peer connection itself (outside the lock to avoid deadlocks).
	// Ignore errors — the PC may already be closed.
	if pc.ConnectionState() != webrtc.PeerConnectionStateClosed {
		for _, sender := range pc.GetSenders() {
			if sender != nil {
				_ = pc.RemoveTrack(sender)
			}
		}
		_ = pc.Close()
	}
	log.Println("peerConnection closed and cleaned up")
}

// applyRemoteDescription sets the remote SDP and flushes buffered ICE candidates.
// Must be called before attachExistingTracks so that resolveCodec can read the
// negotiated payload types from the receiver parameters.
// Returns false (and writes the HTTP error) on failure.
func applyRemoteDescription(c *gin.Context, pc *webrtc.PeerConnection, offer webrtc.SessionDescription, pending []webrtc.ICECandidateInit) bool {
	// Log ICE candidates for debugging
	pc.OnICECandidate(func(cand *webrtc.ICECandidate) {
		if cand != nil {
			log.Printf("ICE candidate gathered: %s", cand.String())
		}
	})

	if err := pc.SetRemoteDescription(offer); err != nil {
		log.Printf("SetRemoteDescription: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set remote description"})
		return false
	}

	// Flush buffered ICE candidates now that remote description is set
	for _, p := range pending {
		if err := pc.AddICECandidate(p); err != nil {
			log.Printf("flush pending ICE: %v", err)
		}
	}
	return true
}

// finalizeAnswer creates the SDP answer, waits for ICE gathering and responds.
// Must be called after attachExistingTracks (tracks must already be added before
// CreateAnswer so they appear in the answer SDP).
// Returns false (and writes the HTTP error) on failure.
func finalizeAnswer(c *gin.Context, pc *webrtc.PeerConnection) bool {
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		log.Printf("CreateAnswer: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create answer"})
		return false
	}

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err = pc.SetLocalDescription(answer); err != nil {
		log.Printf("SetLocalDescription: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set local description"})
		return false
	}
	<-gatherComplete

	final := pc.LocalDescription()
	log.Printf("Answer SDP type=%s length=%d", final.Type.String(), len(final.SDP))
	log.Printf("Answer SDP:\n%s", final.SDP)
	c.JSON(http.StatusOK, gin.H{"sdp": final.SDP})
	return true
}

// ---------------------------------------------------------------------------
// HandleWebRTC — main handler (orchestrates the helpers above)
// ---------------------------------------------------------------------------

// HandleWebRTC godoc
// @Summary      Establish WebRTC connection
// @Description  Create WebRTC peer connection for video streaming (participants only)
// @Tags         webrtc
// @Accept       json
// @Produce      json
// @Param        roomId query string true "Room ID"
// @Param        offer body object true "WebRTC Session Description (SDP offer)"
// @Success      200  {object}  map[string]string "sdp: SDP answer"
// @Failure      400  {object}  map[string]string "error: Room ID is required or Invalid offer"
// @Failure      401  {object}  map[string]string "error: Unauthorized"
// @Failure      403  {object}  map[string]string "error: You are a viewer, WebRTC not allowed"
// @Failure      404  {object}  map[string]string "error: Room not found"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/webrtc [post]
func HandleWebRTC(db *gorm.DB, STUNServerURL string, webrtcIP string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Query("roomId")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room ID is required"})
			return
		}

		// 1. Load room
		mu.Lock()
		room, err := getLiveRoom(db, roomID)
		mu.Unlock()
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}

		// 2. Ensure current user is a participant
		userID := utils.GetContextString(c, "userId")
		if !ensureParticipant(c, db, room, userID) {
			return
		}

		// If the user is the host, transition the live status from "scheduled" to "live"
		if userID == room.Host {
			now := time.Now()
			if err := db.Model(&liveModule.Live{}).
				Where("room_id = ? AND status = ?", roomID, "scheduled").
				Updates(map[string]any{
					"status":     "live",
					"started_at": &now,
				}).Error; err != nil {
				log.Printf("Failed to transition live status to live for room %s: %v", roomID, err)
			}
		}

		// 3. Parse SDP offer
		var offer webrtc.SessionDescription
		if err := c.ShouldBindJSON(&offer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 4. Create PeerConnection
		pc, err := newPeerConnection(STUNServerURL, webrtcIP)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 5. Register peer in room and buffer pending ICE candidates.
		//    We do NOT call attachExistingTracks here yet — resolveCodec needs
		//    the remote description to read negotiated payload types.
		mu.Lock()
		pending := registerPeer(pc, room, userID)
		mu.Unlock()

		// 6. OnTrack — handle incoming media from the publisher
		hlsCtx := &hlsState{}
		peerConnection := pc // capture for closures

		peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
			log.Printf("track received: %s codec=%s PT=%d (StreamID: %s)",
				track.Kind().String(), track.Codec().MimeType,
				track.Codec().PayloadType, track.StreamID())

			// We no longer strictly ignore tracks from non-hosts. All participants can co-stream.

			// Register codec for HLS (Only register HLS for the host stream)
			ci := buildCodecInfo(track.Codec())
			mu.Lock()
			isHost := room.HostPeerCon == peerConnection
			if isHost {
				if track.Kind() == webrtc.RTPCodecTypeAudio {
					hlsCtx.audio = ci
				} else {
					hlsCtx.video = ci
				}
				hlsCtx.trackCount++
				hlsCtx.tryStartHLS(room, roomID)
			}
			mu.Unlock()

			// Create TrackInfo and fan out to all existing peers
			ti := &TrackInfo{
				LocalTracks:   make(map[*webrtc.PeerConnection]*webrtc.TrackLocalStaticRTP),
				PeerPT:        make(map[*webrtc.PeerConnection]uint8),
				SendersByPeer: make(map[*webrtc.PeerConnection]*webrtc.RTPSender),
				Senders:       []*webrtc.RTPSender{},
				Track:         track,
				SourcePC:      peerConnection,
			}
			var renegotiationTargets []renegotiationTarget
			mu.Lock()
			room.Tracks = append(room.Tracks, ti)
			renegotiationTargets = broadcastTrackToPeers(ti, room, peerConnection)
			mu.Unlock()

			for _, target := range renegotiationTargets {
				go requestRenegotiationOffer(room, target.userID, target.pc)
			}

			// Start the relay goroutine.
			// isHost is captured from the enclosing OnTrack closure.
			go startTrackRelay(track, ti, room, peerConnection, isHost)
		})

		// 7. OnConnectionStateChange — cleanup on disconnect
		peerConnection.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
			log.Printf("connection state has changed: %s", state.String())
			if state == webrtc.PeerConnectionStateDisconnected ||
				state == webrtc.PeerConnectionStateFailed ||
				state == webrtc.PeerConnectionStateClosed {
				onPeerDisconnected(db, room, roomID, peerConnection)
			}
		})

		// 8a. Apply remote description first — this populates receiver codec parameters
		//     so that resolveCodec (called in attachExistingTracks below) can read
		//     the negotiated payload types and stamp outgoing RTP packets correctly.
		if !applyRemoteDescription(c, peerConnection, offer, pending) {
			return
		}

		// 8b. NOW attach existing tracks — resolveCodec will find the right PT.
		mu.Lock()
		attachExistingTracks(peerConnection, room)
		mu.Unlock()

		// 8c. Build and send the SDP answer (includes the newly added tracks).
		finalizeAnswer(c, peerConnection)
	}
}
