package rooms

import (
	"log"
	"net/http"
	"os"
	"slices"
	"sync"

	"github.com/Foodstream-io/etchebest/internal/hls"
	"github.com/Foodstream-io/etchebest/models"
	"github.com/Foodstream-io/etchebest/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/pion/webrtc/v3"
	"gorm.io/gorm"
)

type RoomRequest struct {
	Name string `json:"name" binding:"required" example:"My Cooking Stream"`
}

type AddParticipantReq struct {
	RoomId string `json:"roomId" binding:"required" example:"550e8400-e29b-41d4-a716-446655440000"`
	UserId string `json:"userId" binding:"required" example:"550e8400-e29b-41d4-a716-446655440001"`
}

type TrackInfo struct {
	LocalTrack *webrtc.TrackLocalStaticRTP
	Senders    []*webrtc.RTPSender
	Track      *webrtc.TrackRemote
}

type Room struct {
	Connections []*webrtc.PeerConnection
	Tracks      []*TrackInfo
	PendingICE  []webrtc.ICECandidateInit
}

var (
	rooms = make(map[string]*Room)
	mu    sync.Mutex
)

/*
GetRooms godoc
@Summary      Get all rooms
@Description  Retrieve list of all streaming rooms
@Tags         rooms
@Accept       json
@Produce      json
@Success      200  {object}  map[string][]models.Room "rooms: list of rooms"
@Failure      500  {object}  map[string]string "error: Failed to fetch rooms"
@Router       /rooms [get]
*/
func GetRooms(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var rooms []models.Room

		if err := db.Find(&rooms).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
			return
		}

		c.JSON(http.StatusOK, rooms)
	}
}

/*
CreateRoom godoc
@Summary      Create or join a room
@Description  Create a new streaming room or join existing one by name
@Tags         rooms
@Accept       json
@Produce      json
@Security     BearerAuth
@Param        request body RoomRequest true "Room details"
@Success      200  {object}  map[string]interface{} "roomId and message (Room created or Room joined)"
@Failure      400  {object}  map[string]string "error: Room name is required"
@Failure      401  {object}  map[string]string "error: Unauthorized"
@Failure      500  {object}  map[string]string "error: Failed to create room"
@Router       /room [post]
*/
func CreateRoom(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RoomRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Room name is required"})
			return
		}
		var existingRoom models.Room
		if err := db.Where("name = ?", req.Name).First(&existingRoom).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"roomId": existingRoom.ID, "message": "Room joined"})
			return
		}

		user, exists := utils.GetCurrentUser(db, c)
		if exists != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		room := models.Room{
			ID:              uuid.New().String(),
			Name:            req.Name,
			Host:            user.ID,
			Participants:    pq.StringArray{user.ID},
			Viewers:         0,
			MaxParticipants: 5,
		}

		if err := db.Create(&room).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"roomId": room.ID, "message": "Room created"})
	}
}

/*
ReserveRoom godoc
@Summary      Reserve a spot in a room
@Description  Reserve a participant slot in a room in advance
@Tags         rooms
@Accept       json
@Produce      json
@Security     BearerAuth
@Param        request body object{roomId=string} true "Room ID to reserve"
@Success      200  {object}  map[string]string "message: reserved successfully or you already reserved this room"
@Failure      400  {object}  map[string]string "error: RoomID is required"
@Failure      401  {object}  map[string]string "error: Unauthorized"
@Failure      403  {object}  map[string]string "error: Room full, cannot reserve"
@Failure      404  {object}  map[string]string "error: Room not found"
@Failure      500  {object}  map[string]string "error: Failed to save reservation"
@Router       /reserve [post]
*/
func ReserveRoom(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		var req struct {
			RoomID string `json:"roomId" binding:"required"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "roomID is required"})
			return
		}

		user, err := utils.GetCurrentUser(db, c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var room models.Room
		if err := db.First(&room, "id = ?", req.RoomID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room " + req.RoomID + " not found"})
			return
		}

		for _, p := range room.Participants {
			if p == user.ID {
				c.JSON(http.StatusOK, gin.H{"message": "you already reserved this room"})
				return
			}
		}

		if len(room.Participants) >= room.MaxParticipants {
			c.JSON(http.StatusForbidden, gin.H{"error": "Room full, cannot reserve"})
			return
		}

		room.Participants = append(room.Participants, user.ID)
		if err := db.Save(&room).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save reservation"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Reserved successfully"})
	}
}

/*
AddParticipant godoc
@Summary      Add participant to room
@Description  Add a user as a participant to a specific room
@Tags         rooms
@Accept       json
@Produce      json
@Security     BearerAuth
@Param        request body AddParticipantReq true "Room and user IDs"
@Success      200  {object}  map[string]string "status: Participant added or Already participant"
@Failure      400  {object}  map[string]string "error: Invalid body"
@Failure      401  {object}  map[string]string "error: Unauthorized"
@Failure      404  {object}  map[string]string "error: Room not found"
@Router       /addParticipant [post]
*/
func AddParticipant(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AddParticipantReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
			return
		}

		var room models.Room
		if err := db.First(&room, "id = ?", req.RoomId).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}

		if slices.Contains(room.Participants, req.UserId) {
			c.JSON(http.StatusOK, gin.H{"status": "Already participant"})
			return
		}

		room.Participants = append(room.Participants, req.UserId)
		db.Save(&room)

		c.JSON(http.StatusOK, gin.H{"status": "Participant added"})
	}
}

/*
HandleDisconnect godoc
@Summary      Disconnect from room
@Description  Close all WebRTC connections and clean up room resources
@Tags         webrtc
@Accept       json
@Produce      json
@Param        roomId query string true "Room ID"
@Success      200  {object}  map[string]string "message: Disconnected successfully"
@Failure      400  {object}  map[string]string "error: Room ID is required or Room not found or already empty"
@Router       /disconnect [post]
*/
func HandleDisconnect(c *gin.Context) {
	roomID := c.Query("roomId")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
		return
	}

	mu.Lock()
	defer mu.Unlock()

	room, ok := rooms[roomID]
	if !ok || len(room.Connections) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room not found or already empty"})
		return
	}

	for _, pc := range room.Connections {
		if pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
			continue
		}
		for _, sender := range pc.GetSenders() {
			if sender.Track() != nil {
				_ = pc.RemoveTrack(sender)
			}
		}
		pc.Close()
	}

	delete(rooms, roomID)

	c.JSON(http.StatusOK, gin.H{"message": "Disconnected successfully"})
}

/*
HandleICECandidate godoc
@Summary      Handle ICE candidates
@Description  Add ICE candidates for WebRTC connection establishment
@Tags         webrtc
@Accept       json
@Produce      json
@Param        roomId query string true "Room ID"
@Param        candidate body object true "ICE Candidate"
@Success      200  {object}  map[string]string "status: Candidate added or Candidate buffered"
@Failure      400  {object}  map[string]string "error: Room ID is required or Invalid ICE candidate format"
@Failure      500  {object}  map[string]string "error: Failed to add ICE candidate"
@Router       /ice [post]
*/
func HandleICECandidate(c *gin.Context) {
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

	mu.Lock()
	defer mu.Unlock()

	room, ok := rooms[roomID]
	if !ok {
		room = &Room{
			Connections: []*webrtc.PeerConnection{},
			Tracks:      []*TrackInfo{},
			PendingICE:  []webrtc.ICECandidateInit{},
		}
		rooms[roomID] = room
		log.Printf("room %s not found yet, candidate buffered\n", roomID)
		c.JSON(http.StatusOK, gin.H{"status": "candidate buffered"})
		return
	}

	if len(room.Connections) == 0 {
		room.PendingICE = append(room.PendingICE, candidate)
		c.JSON(http.StatusOK, gin.H{"status": "candidate buffered"})
		return
	}

	for _, pc := range room.Connections {
		if err := pc.AddICECandidate(candidate); err != nil {
			log.Printf("failed to add ICE candidate: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add ICE candidate"})
			return
		}
	}
	room.PendingICE = nil

	c.JSON(http.StatusOK, gin.H{"status": "candidate added"})
}

/*
HandleWebRTC godoc
@Summary      Establish WebRTC connection
@Description  Create WebRTC peer connection for video streaming (participants only)
@Tags         webrtc
@Accept       json
@Produce      json
@Param        roomId query string true "Room ID"
@Param        offer body object true "WebRTC Session Description (SDP offer)"
@Success      200  {object}  map[string]string "sdp: SDP answer"
@Failure      400  {object}  map[string]string "error: Room ID is required or Invalid offer"
@Failure      401  {object}  map[string]string "error: Unauthorized"
@Failure      403  {object}  map[string]string "error: You are a viewer, WebRTC not allowed"
@Failure      404  {object}  map[string]string "error: Room not found"
@Failure      500  {object}  map[string]string "error: Internal server error"
@Router       /webrtc [post]
*/
func HandleWebRTC(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		roomID := c.Query("roomId")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
			return
		}

		var dbRoom models.Room
		if err := db.First(&dbRoom, "id = ?", roomID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}

		user, err := utils.GetCurrentUser(db, c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		isParticipant := false
		for _, p := range dbRoom.Participants {
			if p == user.ID {
				isParticipant = true
				break
			}
		}

		if !isParticipant {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are a viewer, WebRTC not allowed"})
			return
		}

		var offer webrtc.SessionDescription
		if err := c.ShouldBindJSON(&offer); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		config := webrtc.Configuration{
			ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.l.google.com:19302"}}},
		}

		peerConnection, err := webrtc.NewPeerConnection(config)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		mu.Lock()
		room, ok := rooms[roomID]
		if !ok {
			room = &Room{
				Connections: []*webrtc.PeerConnection{},
				Tracks:      []*TrackInfo{},
			}
			rooms[roomID] = room
		}

		for _, trackInfo := range room.Tracks {
			sender, err := peerConnection.AddTrack(trackInfo.LocalTrack)
			if err != nil {
				log.Printf("Error adding track to peer: %v", err)
				continue
			}
			trackInfo.Senders = append(trackInfo.Senders, sender)
		}

		room.Connections = append(room.Connections, peerConnection)
		mu.Unlock()

		peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
			log.Printf("Track received: %s (StreamID: %s)", track.Kind().String(), track.StreamID())

			var hlsStdin *os.File

			if track.Kind() == webrtc.RTPCodecTypeVideo && !hls.IsRunning(roomID) {
				log.Println("Starting HLS stream for room", roomID)

				stdin, _, err := hls.Start(roomID)
				if err != nil {
					log.Printf("Failed to start HLS: %v", err)
				} else {
					hlsStdin = stdin
				}
			}

			localTrack, err := webrtc.NewTrackLocalStaticRTP(
				track.Codec().RTPCodecCapability,
				track.ID()+"-"+uuid.New().String(),
				track.StreamID())
			if err != nil {
				log.Printf("Error creating local track: %v", err)
				return
			}

			trackInfo := &TrackInfo{
				LocalTrack: localTrack,
				Senders:    []*webrtc.RTPSender{},
				Track:      track,
			}

			mu.Lock()
			room := rooms[roomID]
			room.Tracks = append(room.Tracks, trackInfo)

			for _, otherPC := range room.Connections {
				if otherPC != peerConnection {
					sender, err := otherPC.AddTrack(localTrack)
					if err != nil {
						log.Printf("Error adding track to peer: %v", err)
						continue
					}
					trackInfo.Senders = append(trackInfo.Senders, sender)
				}
			}
			mu.Unlock()

			go func() {
				buf := make([]byte, 1500)
				for {
					n, _, err := track.Read(buf)
					if err != nil {
						log.Println("Track ended:", err)
						break
					}

					// → WebRTC
					if _, err := localTrack.Write(buf[:n]); err != nil {
						log.Printf("Failed to write to local track: %v", err)
						break
					}

					// → HLS
					if hlsStdin != nil {
						_, _ = hlsStdin.Write(buf[:n])
					}
				}
			}()
		})

		peerConnection.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
			log.Printf("Connection state has changed: %s", state.String())

			if state == webrtc.PeerConnectionStateDisconnected ||
				state == webrtc.PeerConnectionStateFailed ||
				state == webrtc.PeerConnectionStateClosed {

				log.Printf("Peer disconnected from room %s", roomID)

				mu.Lock()
				room, exists := rooms[roomID]
				if !exists || room == nil {
					log.Printf("Room %s does not exist or has already been deleted", roomID)
					mu.Unlock()
					return
				}
				var updatedConnections []*webrtc.PeerConnection
				for _, pc := range room.Connections {
					if pc != peerConnection {
						updatedConnections = append(updatedConnections, pc)
					}
				}
				room.Connections = updatedConnections

				var updatedTracks []*TrackInfo
				for _, trackInfo := range room.Tracks {
					isTrackFromDisconnectedClient := false
					for _, sender := range trackInfo.Senders {
						if sender == nil || sender.Track() == nil || trackInfo.Track == nil {
							continue
						}

						if sender.Track().ID() == trackInfo.Track.ID() {
							isTrackFromDisconnectedClient = true
							break
						}
					}

					if !isTrackFromDisconnectedClient {
						updatedTracks = append(updatedTracks, trackInfo)
					}
				}
				room.Tracks = updatedTracks

				if len(room.Connections) == 0 {
					hls.StopStream(roomID)
					delete(rooms, roomID)
				}
				mu.Unlock()

				for _, sender := range peerConnection.GetSenders() {
					if sender != nil {
						if err := peerConnection.RemoveTrack(sender); err != nil {
							log.Printf("Failed to remove track: %v", err)
						}
					}
				}

				peerConnection.Close()
				log.Println("PeerConnection closed and cleaned up")
			}
		})

		if err = peerConnection.SetRemoteDescription(offer); err != nil {
			log.Printf("Failed to set remote description: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set remote description"})
			return
		}

		answer, err := peerConnection.CreateAnswer(nil)
		if err != nil {
			log.Printf("Failed to create answer: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create answer"})
			return
		}

		if err = peerConnection.SetLocalDescription(answer); err != nil {
			log.Printf("Failed to set local description: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set local description"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"sdp": answer.SDP})
	}
}
