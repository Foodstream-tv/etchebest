package webrtc

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pion/webrtc/v3"
)

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
		log.Println("Room ID missing")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room ID is required"})
		return
	}

	var candidate webrtc.ICECandidateInit
	if err := c.ShouldBindJSON(&candidate); err != nil {
		log.Printf("Failed to bind ICE candidate: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ICE candidate format"})
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
		log.Printf("Room %s not found yet, candidate buffered\n", roomID)
		c.JSON(http.StatusOK, gin.H{"status": "Candidate buffered"})
		return
	}

	if len(room.Connections) == 0 {
		room.PendingICE = append(room.PendingICE, candidate)
		c.JSON(http.StatusOK, gin.H{"status": "Candidate buffered"})
		return
	}

	for _, pc := range room.Connections {
		if err := pc.AddICECandidate(candidate); err != nil {
			log.Printf("Failed to add ICE candidate: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add ICE candidate"})
			return
		}
	}
	room.PendingICE = nil

	c.JSON(http.StatusOK, gin.H{"status": "Candidate added"})
}
