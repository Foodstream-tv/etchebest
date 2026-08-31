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

const errRoomIDRequired = "room ID is required"
const errRoomNotFound = "room not found"


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

// markNeedsRenegotiation sets NeedsRenegotiationByUser[userID] = true under mu.
func markNeedsRenegotiation(room *Room, userID string) {
	mu.Lock()
	if room.NeedsRenegotiationByUser != nil {
		room.NeedsRenegotiationByUser[userID] = true
	}
	mu.Unlock()
}

// initRenegotiationMaps ensures all per-user renegotiation maps are non-nil.
// Must be called with mu held.
func initRenegotiationMaps(room *Room) {
	if room.PendingOfferByUser == nil {
		room.PendingOfferByUser = make(map[string]webrtc.SessionDescription)
	}
	if room.RenegotiatingByUser == nil {
		room.RenegotiatingByUser = make(map[string]bool)
	}
	if room.NeedsRenegotiationByUser == nil {
		room.NeedsRenegotiationByUser = make(map[string]bool)
	}
}

// tryAcquireRenegotiation checks whether a renegotiation is already in progress
// or pending for userID. Returns false if the caller should defer and exit.
// Must be called with mu held; unlocks mu before returning false.
func tryAcquireRenegotiation(room *Room, userID string) bool {
	if _, hasPendingOffer := room.PendingOfferByUser[userID]; hasPendingOffer {
		room.NeedsRenegotiationByUser[userID] = true
		mu.Unlock()
		return false
	}
	if room.RenegotiatingByUser[userID] {
		room.NeedsRenegotiationByUser[userID] = true
		mu.Unlock()
		return false
	}
	room.RenegotiatingByUser[userID] = true
	mu.Unlock()
	return true
}

// logOfferSenders prints a debug summary of current senders on pc.
func logOfferSenders(userID string, pc *webrtc.PeerConnection) {
	log.Printf("Generated renegotiation offer for user %s, has %d senders currently", userID, len(pc.GetSenders()))
	for i, sender := range pc.GetSenders() {
		if sender != nil && sender.Track() != nil {
			log.Printf("  Sender %d: %s track (id=%s)", i, sender.Track().Kind(), sender.Track().ID())
		}
	}
}

// storeOrSendOffer delivers the local offer to the user via WebSocket or
// falls back to the polling map. Must be called with mu held.
func storeOrSendOffer(room *Room, userID string, local *webrtc.SessionDescription) {
	if !sendOfferToUser(room.ID, userID, local) {
		if room.PendingOfferByUser == nil {
			room.PendingOfferByUser = make(map[string]webrtc.SessionDescription)
		}
		room.PendingOfferByUser[userID] = *local
		log.Printf("WebSocket send failed for %s, storing offer for polling", userID)
	}
}

// requestRenegotiationOffer creates and queues a server offer for one user.
// The offer is fetched by the client via polling and answered through
// HandleRenegotiationAnswer.
func requestRenegotiationOffer(room *Room, userID string, pc *webrtc.PeerConnection) {
	if room == nil || pc == nil || userID == "" {
		return
	}

	mu.Lock()
	initRenegotiationMaps(room)
	if !tryAcquireRenegotiation(room, userID) {
		return
	}

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
		markNeedsRenegotiation(room, userID)
		return
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		log.Printf("CreateOffer (renegotiation) failed for user %s: %v", userID, err)
		markNeedsRenegotiation(room, userID)
		return
	}

	logOfferSenders(userID, pc)

	gatherComplete := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		log.Printf("SetLocalDescription (renegotiation) failed for user %s: %v", userID, err)
		markNeedsRenegotiation(room, userID)
		return
	}
	<-gatherComplete

	local := pc.LocalDescription()
	if local == nil {
		markNeedsRenegotiation(room, userID)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	if getPeerConnectionByUser(room, userID) != pc {
		return
	}
	storeOrSendOffer(room, userID, local)
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

// resolveOrCreateTag finds or creates a tag by its name. Returns the tag or an error.
func resolveOrCreateTag(db *gorm.DB, tagName string) (tagModule.Tag, error) {
	cleanName := strings.TrimSpace(tagName)
	if cleanName == "" {
		return tagModule.Tag{}, nil
	}
	slug := strings.ReplaceAll(strings.ToLower(cleanName), " ", "-")
	var tag tagModule.Tag
	if db.Where("slug = ?", slug).First(&tag).Error == nil {
		return tag, nil
	}
	tag = tagModule.Tag{Name: cleanName, Slug: slug, IsActive: true}
	if err := db.Create(&tag).Error; err != nil {
		return tagModule.Tag{}, err
	}
	return tag, nil
}

// resolveTags maps a list of raw tag names to Tag records, creating missing ones.
func resolveTags(db *gorm.DB, names []string) ([]tagModule.Tag, error) {
	tags := make([]tagModule.Tag, 0, len(names))
	for _, name := range names {
		if strings.TrimSpace(name) == "" {
			continue
		}
		tag, err := resolveOrCreateTag(db, name)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

// parseScheduledAt parses an optional RFC3339 timestamp pointer.
func parseScheduledAt(raw *string) (*time.Time, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*raw))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// liveStatus returns the normalised status and optional startedAt for a new live.
func liveStatus(status string) (string, *time.Time) {
	if status == "" {
		status = "scheduled"
	}
	if status == "live" {
		now := time.Now()
		return status, &now
	}
	return status, nil
}

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
		if err := db.Where("user_id = ? AND status IN ?", currentUser.ID, []string{"live", "scheduled"}).
			First(&existingLive).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "you already have an active or scheduled live"})
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

		resolvedTags, err := resolveTags(db, req.Tags)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create tag"})
			return
		}

		scheduledAt, err := parseScheduledAt(req.ScheduledAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid scheduledAt format"})
			return
		}

		status, startedAt := liveStatus(req.Status)

		dishName := ""
		if len(req.Tags) > 0 {
			dishName = req.Tags[0]
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
			ScheduledAt:    scheduledAt,
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

// triggerRenegotiationForRoom notifies all active connections in the live room,
// except the newly joined user, to renegotiate. Must be called with mu held.
func triggerRenegotiationForRoom(db *gorm.DB, logPrefix, roomID, newUserID string) {
	liveRoom, err := getLiveRoom(db, roomID)
	if err != nil || liveRoom == nil {
		return
	}
	log.Printf("[%s] triggering renegotiation for new participant %s in room %s", logPrefix, newUserID, roomID)
	for _, conn := range liveRoom.Connections {
		if conn.UserID != newUserID && conn.PeerCon != nil {
			go requestRenegotiationOffer(liveRoom, conn.UserID, conn.PeerCon)
		}
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
		if err = SaveRoom(db, room); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save reservation"})
			return
		}

		mu.Lock()
		triggerRenegotiationForRoom(db, "RESERVE_ROOM", roomId, currentUserId)
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
			c.JSON(http.StatusNotFound, gin.H{"error": errRoomNotFound})
			return
		}

		if slices.Contains(room.Participants, req.UserId) {
			c.JSON(http.StatusOK, gin.H{"status": "already participant"})
			return
		}

		room.Participants = append(room.Participants, req.UserId)
		if err = SaveRoom(db, room); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save reservation"})
			return
		}

		mu.Lock()
		triggerRenegotiationForRoom(db, "ADD_PARTICIPANT", req.RoomId, req.UserId)
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
			c.JSON(http.StatusBadRequest, gin.H{"error": errRoomIDRequired})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": errRoomIDRequired})
			return
		}

		userID := utils.GetContextString(c, "userId")

		mu.Lock()
		room, err := getLiveRoom(db, roomID)
		if err != nil {
			mu.Unlock()
			c.JSON(http.StatusNotFound, gin.H{"error": errRoomNotFound})
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
			c.JSON(http.StatusBadRequest, gin.H{"error": errRoomIDRequired})
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
			c.JSON(http.StatusNotFound, gin.H{"error": errRoomNotFound})
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


// skipVP8ExtendedDescriptor advances offset past the extended VP8 descriptor
// fields (I, L, T/K sub-fields) as described in RFC 7741.
// Returns the new offset, or -1 if the payload is too short.
func skipVP8ExtendedDescriptor(payload []byte, offset int, xByte byte) int {
	// PictureID (I bit)
	if xByte&0x80 != 0 {
		if offset >= len(payload) {
			return -1
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
	return offset
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
		offset = skipVP8ExtendedDescriptor(payload, offset, xByte)
		if offset < 0 {
			return false
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
// hlsVideoState tracks mutable per-goroutine HLS gate state for a video relay.
type hlsVideoState struct {
	gotKeyframe    bool
	keyframeTime   time.Time
	receivedSPS    bool
	receivedPPS    bool
	paramsGateTime time.Time
	pliSentCount   int
	seqNum         uint16
}

// sendPLIBurst sends n PLI packets to request SPS/PPS from the sender.
func (s *hlsVideoState) sendPLIBurst(pc *webrtc.PeerConnection, ssrc uint32, n int) {
	for i := 0; i < n; i++ {
		if err := pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: ssrc}}); err != nil {
			log.Printf("[HLS] failed to send PLI: %v", err)
		}
		s.pliSentCount++
	}
}

// processH264 applies the H264 codec-param gate. Returns false if the packet should be skipped.
// updateH264ParamTracking records first-seen SPS/PPS and opens the gate clock.
func (s *hlsVideoState) updateH264ParamTracking(isSPS, isPPS bool, payload []byte) {
	if (isSPS || isPPS) && len(payload) > 0 {
		log.Printf("[HLS] Codec param detected: type=%d SPS=%v PPS=%v", payload[0]&0x1f, isSPS, isPPS)
	}
	if isSPS && !s.receivedSPS {
		s.receivedSPS = true
		log.Printf("[HLS] SPS received for room, starting params gate window")
		if s.paramsGateTime.IsZero() {
			s.paramsGateTime = time.Now()
		}
	}
	if isPPS && !s.receivedPPS {
		s.receivedPPS = true
		log.Printf("[HLS] PPS received for room")
		if s.paramsGateTime.IsZero() {
			s.paramsGateTime = time.Now()
		}
	}
}

// runParamsPLIGate sends periodic PLI while waiting for SPS+PPS,
// and force-opens the gate after 2 s. Returns true if the gate just timed out.
func (s *hlsVideoState) runParamsPLIGate(pc *webrtc.PeerConnection, ssrc uint32) {
	if s.paramsGateTime.IsZero() || (s.receivedSPS && s.receivedPPS) {
		return
	}
	elapsed := time.Since(s.paramsGateTime)
	if elapsed > 0 && int(elapsed.Milliseconds())%150 == 0 && s.pliSentCount < 15 {
		if err := pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: ssrc}}); err == nil {
			s.pliSentCount++
		}
	}
	if elapsed >= 2000*time.Millisecond && !s.gotKeyframe {
		s.gotKeyframe = true
		log.Printf("[HLS] timeout on params gate (waited 2s, SPS=%v PPS=%v), opening gate anyway", s.receivedSPS, s.receivedPPS)
	}
}

// processH264 applies the H264 codec-param gate. Returns false if the packet should be skipped.
func (s *hlsVideoState) processH264(pc *webrtc.PeerConnection, track *webrtc.TrackRemote, pkt *rtp.Packet) bool {
	isSPS := isH264SPS(pkt.Payload)
	isPPS := isH264PPS(pkt.Payload)
	isSlice := isH264SliceData(pkt.Payload)

	s.updateH264ParamTracking(isSPS, isPPS, pkt.Payload)

	if isH264KeyframeWithParams(pkt.Payload) && s.keyframeTime.IsZero() {
		s.keyframeTime = time.Now()
		s.paramsGateTime = time.Now()
		log.Printf("[HLS] keyframe detected for room, requesting codec params with PLI burst")
		s.sendPLIBurst(pc, uint32(track.SSRC()), 5)
	}

	s.runParamsPLIGate(pc, uint32(track.SSRC()))

	if s.receivedSPS && s.receivedPPS && !s.gotKeyframe {
		s.gotKeyframe = true
		log.Printf("[HLS] codec params ready for room (SPS+PPS received in %dms), sent %d PLI requests, starting video stream",
			time.Since(s.paramsGateTime).Milliseconds(), s.pliSentCount)
	}

	return !isSlice || s.gotKeyframe
}

// processVP8 applies the VP8 keyframe gate. Returns false if the packet should be skipped.
func (s *hlsVideoState) processVP8(pkt *rtp.Packet, mimeType string) bool {
	if s.gotKeyframe {
		return true
	}
	var isKF bool
	if strings.Contains(mimeType, "vp8") {
		isKF = isVP8Keyframe(pkt.Payload)
	} else {
		isKF = true
	}
	if isKF && s.keyframeTime.IsZero() {
		s.keyframeTime = time.Now()
		s.gotKeyframe = true
		log.Printf("[HLS] keyframe detected for room (codec=%s), video feed started", mimeType)
	}
	return s.gotKeyframe
}

// refreshPeerSnapshot rebuilds the cached peer list and HLS writer under mu.
func refreshPeerSnapshot(ti *TrackInfo, room *Room, origPT uint8) ([]peerTrack, *hls.HLSWriter) {
	mu.Lock()
	defer mu.Unlock()
	peers := make([]peerTrack, 0, len(ti.LocalTracks))
	for pc, lt := range ti.LocalTracks {
		pt := ti.PeerPT[pc]
		if pt == 0 {
			pt = origPT
		}
		peers = append(peers, peerTrack{lt, pt})
	}
	return peers, room.HLSWriter
}

// sendHLSVideoPacket sends a processed video RTP packet to FFmpeg via the HLS writer.
// Handles STAP-A deserialization for H264.
func sendHLSVideoPacket(writer *hls.HLSWriter, pkt *rtp.Packet, mimeType string, state *hlsVideoState) {
	if writer == nil || writer.VideoConn == nil {
		return
	}
	// For H264, deserialize STAP-A into individual NAL units
	if strings.Contains(mimeType, "h264") && len(pkt.Payload) > 0 {
		if pkt.Payload[0]&0x1f == 24 {
			if extractAndSendAllSTAPAUnits(pkt.Payload, writer.VideoConn, pkt, &state.seqNum) {
				log.Printf("[HLS] Deserialized STAP-A packet (skipping aggregated form)")
				return
			}
		}
	}
	pkt.SequenceNumber = state.seqNum
	state.seqNum++
	if data, err := pkt.Marshal(); err == nil {
		_, _ = writer.VideoConn.Write(data)
	}
}

// readNextRTPPacket reads and unmarshals the next RTP packet from track into buf.
func readNextRTPPacket(track *webrtc.TrackRemote, buf []byte) (*rtp.Packet, int, error) {
	n, _, err := track.Read(buf)
	if err != nil {
		return nil, 0, err
	}
	var pkt rtp.Packet
	if err := pkt.Unmarshal(buf[:n]); err != nil {
		return nil, n, err
	}
	return &pkt, n, nil
}

// fanoutToPeers sends the RTP packet to all cached peers, rewriting the payload type per-peer.
func fanoutToPeers(pkt *rtp.Packet, peers []peerTrack) {
	for _, p := range peers {
		pktCopy := *pkt
		pktCopy.PayloadType = p.pt
		_ = p.lt.WriteRTP(&pktCopy)
	}
}

func isNonPrimaryVideo(isAudio bool, pktPT uint8, primaryPT uint8) bool {
	return !isAudio && pktPT != primaryPT
}

// hlsVideoRelay manages HLS video stream state and packet forwarding for a relay.
type hlsVideoRelay struct {
	state      hlsVideoState
	pliLastPkt int
}

func (r *hlsVideoRelay) shouldRelay(isHLSSource bool, writer *hls.HLSWriter) bool {
	return isHLSSource && writer != nil
}

// relay forwards audio or video packets to HLS.
func (r *hlsVideoRelay) relay(
	isAudio bool,
	writer *hls.HLSWriter,
	rawBuf []byte,
	pkt *rtp.Packet,
	track *webrtc.TrackRemote,
	pc *webrtc.PeerConnection,
	pktCount int,
) {
	if isAudio {
		if writer.AudioConn != nil {
			_, _ = writer.AudioConn.Write(rawBuf)
		}
		return
	}
	r.relayVideo(writer, pkt, track, pc, pktCount)
}

// relayVideo applies the codec-specific keyframe gate and, when open, forwards video RTP to FFmpeg.
func (r *hlsVideoRelay) relayVideo(
	writer *hls.HLSWriter,
	pkt *rtp.Packet,
	track *webrtc.TrackRemote,
	pc *webrtc.PeerConnection,
	pktCount int,
) {
	if writer.VideoConn == nil || pkt.PayloadType != uint8(track.Codec().PayloadType) {
		return
	}

	mimeType := strings.ToLower(track.Codec().MimeType)

	if pktCount-r.pliLastPkt >= 150 {
		r.pliLastPkt = pktCount
		_ = pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(track.SSRC())}})
	}

	var gated bool
	if strings.Contains(mimeType, "h264") {
		gated = r.state.processH264(pc, track, pkt)
	} else {
		gated = r.state.processVP8(pkt, mimeType)
	}
	if !gated {
		return
	}

	sendHLSVideoPacket(writer, pkt, mimeType, &r.state)
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
	primaryPT := uint8(track.Codec().PayloadType)
	var hlsRelay hlsVideoRelay

	// Request a keyframe immediately so that both HLS and all WebRTC
	// receiving peers get a clean start for the video feed.
	if !isAudio {
		requestKeyframeBurst(pc, uint32(track.SSRC()))
	}

	for {
		pkt, n, err := readNextRTPPacket(track, buf)
		if err != nil {
			log.Println("track ended:", err)
			return
		}
		if pkt == nil {
			continue
		}

		pktCount++
		if isNonPrimaryVideo(isAudio, pkt.PayloadType, primaryPT) {
			continue
		}

		if pktCount%100 == 1 {
			cachedPeers, cachedWriter = refreshPeerSnapshot(ti, room, pkt.PayloadType)
		}

		fanoutToPeers(pkt, cachedPeers)

		if hlsRelay.shouldRelay(isHLSSource, cachedWriter) {
			hlsRelay.relay(isAudio, cachedWriter, buf[:n], pkt, track, pc, pktCount)
		}
	}
}


// onPeerDisconnected cleans up room state when a peer leaves.
// It is safe to call multiple times for the same PC (idempotent).
// removeParticipantState removes a disconnected user from participants, DB, and
// per-user maps. Must be called with mu held.
func removeParticipantState(db *gorm.DB, room *Room, userID string) {
	updated := make(pq.StringArray, 0, len(room.Participants))
	for _, p := range room.Participants {
		if p != userID {
			updated = append(updated, p)
		}
	}
	room.Participants = updated
	if err := SaveRoom(db, room); err != nil {
		log.Printf("failed to save room after removing participant: %v", err)
	}
	if room.PendingICEByUser != nil {
		delete(room.PendingICEByUser, userID)
	}
	if room.PendingOfferByUser != nil {
		delete(room.PendingOfferByUser, userID)
	}
	if room.RenegotiatingByUser != nil {
		delete(room.RenegotiatingByUser, userID)
	}
	if room.NeedsRenegotiationByUser != nil {
		delete(room.NeedsRenegotiationByUser, userID)
	}
}

// removeSourceTrack removes all senders for a source track from every receiving peer.
func removeSourceTrack(ti *TrackInfo) {
	if ti.SendersByPeer == nil {
		return
	}
	log.Printf("Removing track from %d receiving peers", len(ti.SendersByPeer))
	for otherPc, sender := range ti.SendersByPeer {
		if otherPc == nil || sender == nil {
			continue
		}
		if err := otherPc.RemoveTrack(sender); err != nil {
			log.Printf("RemoveTrack failed: %v", err)
		} else {
			log.Printf("RemoveTrack succeeded for peer")
		}
	}
}

// removeTracksFromPeer rebuilds the track list, removing source tracks from pc
// and cleaning per-peer state for pc from surviving tracks.
// Must be called with mu held.
func removeTracksFromPeer(room *Room, pc *webrtc.PeerConnection) []*TrackInfo {
	updated := make([]*TrackInfo, 0, len(room.Tracks))
	for _, ti := range room.Tracks {
		if ti.SourcePC == pc {
			removeSourceTrack(ti)
			log.Printf("Skipping track from disconnected peer (track will be removed from room)")
			continue
		}
		if ti.LocalTracks != nil {
			delete(ti.LocalTracks, pc)
		}
		if ti.PeerPT != nil {
			delete(ti.PeerPT, pc)
		}
		if ti.SendersByPeer != nil {
			delete(ti.SendersByPeer, pc)
		}
		updated = append(updated, ti)
	}
	return updated
}

// teardownEmptyRoom stops HLS, marks the live as ended, and removes the DB record.
// Must be called with mu held.
func teardownEmptyRoom(db *gorm.DB, room *Room, roomID string) {
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

// closeDisconnectedPC removes all senders and closes pc outside the lock.
func closeDisconnectedPC(pc *webrtc.PeerConnection) {
	if pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
		return
	}
	for _, sender := range pc.GetSenders() {
		if sender != nil {
			_ = pc.RemoveTrack(sender)
		}
	}
	_ = pc.Close()
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
		removeParticipantState(db, room, disconnectedUserID)
	}
	if room.HostPeerCon == pc {
		room.HostPeerCon = nil
	}

	room.Tracks = removeTracksFromPeer(room, pc)
	log.Printf("After cleanup: room has %d tracks", len(room.Tracks))

	// Collect renegotiation targets before releasing the lock
	var renegotiationTargets []renegotiationTarget
	for _, conn := range room.Connections {
		if conn.PeerCon != nil {
			renegotiationTargets = append(renegotiationTargets, renegotiationTarget{
				userID: conn.UserID,
				pc:     conn.PeerCon,
			})
		}
	}

	if len(room.Connections) == 0 {
		teardownEmptyRoom(db, room, roomID)
	}
	mu.Unlock()

	// Trigger renegotiation for remaining peers outside the lock
	for _, target := range renegotiationTargets {
		go requestRenegotiationOffer(room, target.userID, target.pc)
	}

	closeDisconnectedPC(pc)
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

// maybeTransitionToLive transitions the live from "scheduled" to "live" when the host connects.
func maybeTransitionToLive(db *gorm.DB, room *Room, userID, roomID string) {
	if userID != room.Host {
		return
	}
	now := time.Now()
	if err := db.Model(&liveModule.Live{}).
		Where("room_id = ? AND status = ?", roomID, "scheduled").
		Updates(map[string]any{"status": "live", "started_at": &now}).Error; err != nil {
		log.Printf("Failed to transition live status to live for room %s: %v", roomID, err)
	}
}

// handleOnTrack processes a new incoming media track: registers it for HLS,
// fans it out to existing peers, and starts the relay goroutine.
func handleOnTrack(
	track *webrtc.TrackRemote,
	room *Room, roomID string,
	peerConnection *webrtc.PeerConnection,
	hlsCtx *hlsState,
) {
	log.Printf("track received: %s codec=%s PT=%d (StreamID: %s)",
		track.Kind().String(), track.Codec().MimeType,
		track.Codec().PayloadType, track.StreamID())

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

	ti := &TrackInfo{
		LocalTracks:   make(map[*webrtc.PeerConnection]*webrtc.TrackLocalStaticRTP),
		PeerPT:        make(map[*webrtc.PeerConnection]uint8),
		SendersByPeer: make(map[*webrtc.PeerConnection]*webrtc.RTPSender),
		Senders:       []*webrtc.RTPSender{},
		Track:         track,
		SourcePC:      peerConnection,
	}
	mu.Lock()
	room.Tracks = append(room.Tracks, ti)
	renegotiationTargets := broadcastTrackToPeers(ti, room, peerConnection)
	mu.Unlock()

	for _, target := range renegotiationTargets {
		go requestRenegotiationOffer(room, target.userID, target.pc)
	}

	go startTrackRelay(track, ti, room, peerConnection, isHost)
}

// makeConnectionStateHandler returns an OnConnectionStateChange callback that
// triggers cleanup when the peer disconnects or fails.
func makeConnectionStateHandler(
	db *gorm.DB, room *Room, roomID string,
	peerConnection *webrtc.PeerConnection,
) func(webrtc.PeerConnectionState) {
	return func(state webrtc.PeerConnectionState) {
		log.Printf("connection state has changed: %s", state.String())
		if state == webrtc.PeerConnectionStateDisconnected ||
			state == webrtc.PeerConnectionStateFailed ||
			state == webrtc.PeerConnectionStateClosed {
			onPeerDisconnected(db, room, roomID, peerConnection)
		}
	}
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
			c.JSON(http.StatusBadRequest, gin.H{"error": errRoomIDRequired})
			return
		}

		// 1. Load room
		mu.Lock()
		room, err := getLiveRoom(db, roomID)
		mu.Unlock()
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": errRoomNotFound})
			return
		}

		// 2. Ensure current user is a participant
		userID := utils.GetContextString(c, "userId")
		if !ensureParticipant(c, db, room, userID) {
			return
		}

		// 3. Transition host live status from "scheduled" to "live"
		maybeTransitionToLive(db, room, userID, roomID)

		// 4. Parse SDP offer
		var offer webrtc.SessionDescription
		if err := c.ShouldBindJSON(&offer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 5. Create PeerConnection
		pc, err := newPeerConnection(STUNServerURL, webrtcIP)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 6. Register peer and retrieve buffered ICE candidates.
		mu.Lock()
		pending := registerPeer(pc, room, userID)
		mu.Unlock()

		// 7. Wire callbacks
		hlsCtx := &hlsState{}
		peerConnection := pc // capture for closures
		peerConnection.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
			handleOnTrack(track, room, roomID, peerConnection, hlsCtx)
		})
		peerConnection.OnConnectionStateChange(makeConnectionStateHandler(db, room, roomID, peerConnection))

		// 8a. Apply remote description (populates receiver codec parameters for resolveCodec).
		if !applyRemoteDescription(c, peerConnection, offer, pending) {
			return
		}

		// 8b. Attach existing tracks — resolveCodec will find the right PT.
		mu.Lock()
		attachExistingTracks(peerConnection, room)
		mu.Unlock()

		// 8c. Build and send the SDP answer (includes the newly added tracks).
		finalizeAnswer(c, peerConnection)
	}
}
