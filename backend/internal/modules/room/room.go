package room

import (
	"github.com/lib/pq"
	"log"
	"net/http"
	"os"
	"slices"
	"sync"

	"github.com/Foodstream-io/etchebest/internal/hls"
	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	mu sync.Mutex
)

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
			MaxParticipants: 5,
		}

		err := CreateRoom(db, &room)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room"})
			return
		}
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
		defer mu.Unlock()

		room, err := GetRoomById(db, roomId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room " + roomId + " not found"})
			return
		}

		if len(room.Connections) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "room not found or already empty"})
			return
		}

		for _, pc := range room.Connections {
			if pc.PeerCon.ConnectionState() == webrtc.PeerConnectionStateClosed {
				continue
			}
			for _, sender := range pc.PeerCon.GetSenders() {
				if sender.Track() != nil {
					_ = pc.PeerCon.RemoveTrack(sender)
				}
			}
			err := pc.PeerCon.Close()
			if err != nil {
				log.Printf("couldn't close connection tracker: %v", err)
			}
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

		var candidate ICECandidateInit
		if err := c.ShouldBindJSON(&candidate); err != nil {
			log.Printf("failed to bind ICE candidate: %v\n", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ICE candidate format"})
			return
		}

		mu.Lock()
		defer mu.Unlock()

		room, err := GetRoomById(db, roomID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}

		if len(room.Connections) == 0 {
			room.PendingICE = append(room.PendingICE, candidate)
			c.JSON(http.StatusOK, gin.H{"status": "candidate buffered"})
			return
		}

		for _, pc := range room.Connections {
			if err := pc.PeerCon.AddICECandidate(candidate.Candidate); err != nil {
				log.Printf("failed to add ICE candidate: %v\n", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add ICE candidate"})
				return
			}
		}
		room.PendingICE = nil

		c.JSON(http.StatusOK, gin.H{"status": "candidate added"})
	}
}

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

		room, err := GetRoomById(db, roomID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}

		currentUserId := utils.GetContextString(c, "userId")
		isParticipant := false
		for _, p := range room.Participants {
			if p == currentUserId {
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
			ICEServers: []webrtc.ICEServer{{URLs: []string{STUNServerURL}}},
		}

		// Configure ICE for Docker NAT traversal
		settingEngine := webrtc.SettingEngine{}
		if webrtcIP != "" {
			settingEngine.SetNAT1To1IPs([]string{webrtcIP}, webrtc.ICECandidateTypeHost)
		}
		settingEngine.SetEphemeralUDPPortRange(50000, 50100)

		api := webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine))
		peerConnection, err := api.NewPeerConnection(config)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		mu.Lock()

		for _, trackInfo := range room.Tracks {
			sender, err := peerConnection.AddTrack(trackInfo.LocalTrack)
			if err != nil {
				log.Printf("error adding track to peer: %v", err)
				continue
			}
			trackInfo.Senders = append(trackInfo.Senders, sender)
		}

		room.Connections = append(room.Connections, PeerConnection{PeerCon: peerConnection})

		// Save pending ICE candidates to flush after SetRemoteDescription
		pendingCandidates := make([]ICECandidateInit, len(room.PendingICE))
		copy(pendingCandidates, room.PendingICE)
		room.PendingICE = nil

		mu.Unlock()

		peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
			log.Printf("track received: %s (StreamID: %s)", track.Kind().String(), track.StreamID())

			var hlsStdin *os.File

			if track.Kind() == webrtc.RTPCodecTypeVideo && !hls.IsRunning(roomID) {
				log.Println("starting HLS stream for room", roomID)

				stdin, _, err := hls.Start(roomID)
				if err != nil {
					log.Printf("failed to start HLS: %v", err)
				} else {
					hlsStdin = stdin
				}
			}

			localTrack, err := webrtc.NewTrackLocalStaticRTP(
				track.Codec().RTPCodecCapability,
				track.ID()+"-"+uuid.New().String(),
				track.StreamID())
			if err != nil {
				log.Printf("error creating local track: %v", err)
				return
			}

			trackInfo := &TrackInfo{
				LocalTrack: localTrack,
				Senders:    []*webrtc.RTPSender{},
				Track:      track,
			}

			mu.Lock()
			room.Tracks = append(room.Tracks, trackInfo)

			for _, otherPC := range room.Connections {
				if otherPC.PeerCon != peerConnection {
					sender, err := otherPC.PeerCon.AddTrack(localTrack)
					if err != nil {
						log.Printf("error adding track to peer: %v", err)
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
						log.Println("track ended:", err)
						break
					}

					// → WebRTC
					if _, err := localTrack.Write(buf[:n]); err != nil {
						log.Printf("failed to write to local track: %v", err)
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
			log.Printf("connection state has changed: %s", state.String())

			if state == webrtc.PeerConnectionStateDisconnected ||
				state == webrtc.PeerConnectionStateFailed ||
				state == webrtc.PeerConnectionStateClosed {

				log.Printf("peer disconnected from room %s", roomID)

				mu.Lock()
				// TODO: to check
				/*
					if !exists {
						log.Printf("room %s does not exist or has already been deleted", roomID)
						mu.Unlock()
						return
					}*/
				var updatedConnections []PeerConnection
				for _, pc := range room.Connections {
					if pc.PeerCon != peerConnection {
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
					err := DeleteRoomById(db, roomID)
					if err != nil {
						log.Printf("failed to delete room: %v", err)
					}
				}
				mu.Unlock()

				for _, sender := range peerConnection.GetSenders() {
					if sender != nil {
						if err := peerConnection.RemoveTrack(sender); err != nil {
							log.Printf("failed to remove track: %v", err)
						}
					}
				}

				err := peerConnection.Close()
				if err != nil {
					log.Printf("failed to close peer: %v", err)
				}
				log.Println("peerConnection closed and cleaned up")
			}
		})

		// Log ICE candidates for debugging
		peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
			if candidate != nil {
				log.Printf("ICE candidate gathered: %s", candidate.String())
			}
		})

		if err = peerConnection.SetRemoteDescription(offer); err != nil {
			log.Printf("Failed to set remote description: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set remote description"})
			return
		}

		// Now that remote description is set, flush buffered ICE candidates
		if len(pendingCandidates) > 0 {
			log.Printf("flushing %d pending ICE candidates", len(pendingCandidates))
			for _, pending := range pendingCandidates {
				if err := peerConnection.AddICECandidate(pending.Candidate); err != nil {
					log.Printf("failed to add pending ICE candidate: %v", err)
				}
			}
		}

		answer, err := peerConnection.CreateAnswer(nil)
		if err != nil {
			log.Printf("Failed to create answer: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create answer"})
			return
		}

		// Create a channel that signals when ICE gathering is complete
		gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

		if err = peerConnection.SetLocalDescription(answer); err != nil {
			log.Printf("Failed to set local description: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set local description"})
			return
		}

		// Wait for ICE gathering to finish so candidates are embedded in the SDP
		<-gatherComplete
		log.Printf("ICE gathering complete")

		// Return the full local description (with ICE candidates embedded)
		finalDesc := peerConnection.LocalDescription()
		c.JSON(http.StatusOK, gin.H{"sdp": finalDesc.SDP})
	}
}
