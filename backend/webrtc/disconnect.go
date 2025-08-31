package webrtc

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pion/webrtc/v3"
)

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
