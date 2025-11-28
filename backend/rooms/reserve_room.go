package rooms

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/config"
	"github.com/Foodstream-io/etchebest/models"

	"github.com/gin-gonic/gin"
)

func ReserveRoom(c *gin.Context) {
	var req struct {
		RoomID string `json:"roomId" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RoomID is required"})
		return
	}

	userID, _ := c.Get("userId")
	if userID == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var room models.Room
	if err := config.DB.First(&room, "id = ?", req.RoomID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	for _, p := range room.Participants {
		if p == userID.(string) {
			c.JSON(http.StatusOK, gin.H{"message": "Already reserved"})
			return
		}
	}

	if len(room.Participants) >= room.MaxParticipants {
		c.JSON(http.StatusForbidden, gin.H{"error": "Room full, cannot reserve"})
		return
	}

	room.Participants = append(room.Participants, userID.(string))
	if err := config.DB.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save reservation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Reserved successfully"})
}
