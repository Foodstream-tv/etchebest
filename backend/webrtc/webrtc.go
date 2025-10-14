package webrtc

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pion/webrtc/v3"
)

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

func HandleWebRTC(c *gin.Context) {
	roomID := c.Query("roomId")
	if roomID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
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

		go func(track *webrtc.TrackRemote, localTrack *webrtc.TrackLocalStaticRTP) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Recovered from panic: %v", r)
				}
			}()
			buf := make([]byte, 1500)
			for {
				n, _, readErr := track.Read(buf)
				if readErr != nil {
					log.Printf("Track ended: %v", readErr)
					break
				}
				if _, writeErr := localTrack.Write(buf[:n]); writeErr != nil {
					log.Printf("Failed to write to local track: %v", writeErr)
					break
				}
			}
		}(trackInfo.Track, trackInfo.LocalTrack)
	}

	room.Connections = append(room.Connections, peerConnection)
	mu.Unlock()

	peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		log.Printf("Track received: %s (StreamID: %s)", track.Kind().String(), track.StreamID())

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

				go func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Recovered from panic: %v", r)
						}
					}()
					buf := make([]byte, 1500)
					for {
						n, _, readErr := track.Read(buf)
						if readErr != nil {
							log.Printf("Track ended: %v", readErr)
							break
						}
						if _, writeErr := localTrack.Write(buf[:n]); writeErr != nil {
							log.Printf("Failed to write to local track: %v", writeErr)
							break
						}
					}
				}()
			}
		}
		mu.Unlock()
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
