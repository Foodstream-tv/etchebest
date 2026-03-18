package room

import (
	"github.com/lib/pq"
	"log"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pion/rtcp"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v3"
	"gorm.io/gorm"
)

type Request struct {
	Name string `json:"name" binding:"required" example:"My Cooking Stream"`
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
		room := Room{
			ID:              uuid.New().String(),
			Name:            req.Name,
			Host:            currentUserId,
			Participants:    pq.StringArray{currentUserId},
			Viewers:         0,
			MaxParticipants: 10,
		}

		err := CreateRoom(db, &room)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
			return
		}

		mu.Lock()
		liveRooms[room.ID] = &room
		mu.Unlock()

		c.JSON(http.StatusOK, gin.H{"roomId": room.ID, "message": "room created"})
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

		mu.Lock()
		room, err := getLiveRoom(db, roomId)
		if err != nil {
			// Room is already gone (deleted by a concurrent disconnect) — idempotent.
			mu.Unlock()
			c.JSON(http.StatusOK, gin.H{"message": "disconnected successfully"})
			return
		}

		// Snapshot connections so we can close them outside the lock
		conns := make([]PeerConnection, len(room.Connections))
		copy(conns, room.Connections)

		// Tear down room state
		hls.StopStream(roomId)
		room.Connections = nil
		room.Tracks = nil
		room.HostPeerCon = nil
		room.HLSWriter = nil
		removeLiveRoom(roomId)

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
func broadcastTrackToPeers(ti *TrackInfo, room *Room, sourcePc *webrtc.PeerConnection) {
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
		ti.Senders = append(ti.Senders, sender)
	}
}

func requestKeyframeBurst(pc *webrtc.PeerConnection, ssrc uint32) {
	if pc == nil || ssrc == 0 {
		return
	}
	go func() {
		for i := 0; i < 4; i++ {
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

			// Gate: only forward video to FFmpeg from the first keyframe onwards.
			// Interframes before a keyframe cause FFmpeg's VP8 decoder to spam
			// "Discarding interframe without a prior keyframe" and never produce
			// HLS segments.
			// H264 is excluded from the gate because it uses copy mode (no
			// decoding) and FFmpeg needs every packet — especially SPS/PPS
			// (NAL types 7/8) which arrive before IDR frames.
			if !hlsGotKeyframe && !strings.Contains(mimeType, "h264") {
				var isKF bool
				switch {
				case strings.Contains(mimeType, "vp8"):
					isKF = isVP8Keyframe(pkt.Payload)
				default:
					isKF = true
				}
				if !isKF {
					continue
				}
				hlsGotKeyframe = true
				log.Printf("[HLS] first keyframe received for room (codec=%s), video feed started", track.Codec().MimeType)
			}

			_, _ = cachedWriter.VideoConn.Write(buf[:n])
		}
	}
}

// onPeerDisconnected cleans up room state when a peer leaves.
// It is safe to call multiple times for the same PC (idempotent).
func onPeerDisconnected(db *gorm.DB, room *Room, roomID string, pc *webrtc.PeerConnection) {
	mu.Lock()

	// Guard: if this PC is not in the connection list, it was already cleaned up.
	found := false
	updated := make([]PeerConnection, 0, len(room.Connections))
	for _, c := range room.Connections {
		if c.PeerCon == pc {
			found = true
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

	// Clear the host pointer if this was the publisher
	if room.HostPeerCon == pc {
		room.HostPeerCon = nil
	}

	// Remove per-peer LocalTracks for the disconnecting peer
	for _, ti := range room.Tracks {
		if ti.LocalTracks != nil {
			delete(ti.LocalTracks, pc)
		}
		if ti.PeerPT != nil {
			delete(ti.PeerPT, pc)
		}
	}

	empty := len(room.Connections) == 0
	if empty {
		hls.StopStream(roomID)
		room.Tracks = nil
		removeLiveRoom(roomID)
		if err := DeleteRoomById(db, roomID); err != nil {
			log.Printf("failed to delete room %s: %v", roomID, err)
		} else {
			log.Printf("room %s deleted (last peer left)", roomID)
		}
	}
	mu.Unlock()

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

// negotiateSDP performs the SDP offer/answer exchange and waits for ICE
// gathering to complete. Returns false (and writes the HTTP error) on failure.
func negotiateSDP(c *gin.Context, pc *webrtc.PeerConnection, offer webrtc.SessionDescription, pending []webrtc.ICECandidateInit) bool {
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

		// 5. Subscribe new peer to existing tracks & register in room
		mu.Lock()
		attachExistingTracks(pc, room)

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
				LocalTracks: make(map[*webrtc.PeerConnection]*webrtc.TrackLocalStaticRTP),
				PeerPT:      make(map[*webrtc.PeerConnection]uint8),
				Senders:     []*webrtc.RTPSender{},
				Track:       track,
				SourcePC:    peerConnection,
			}
			mu.Lock()
			room.Tracks = append(room.Tracks, ti)
			broadcastTrackToPeers(ti, room, peerConnection)
			mu.Unlock()

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

		// 8. SDP negotiation & respond
		negotiateSDP(c, peerConnection, offer, pending)
	}
}
