package webrtc

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pion/webrtc/v3"
)

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
