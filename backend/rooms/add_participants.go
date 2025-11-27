package rooms

import (
	"net/http"
	"slices"

	"github.com/Foodstream-io/etchebest/config"
	"github.com/Foodstream-io/etchebest/models"

	"github.com/gin-gonic/gin"
)

type AddParticipantReq struct {
	RoomId string `json:"roomId"`
	UserId string `json:"userId"`
}

func AddParticipant(c *gin.Context) {
	var req AddParticipantReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
		return
	}

	var room models.Room
	if err := config.DB.First(&room, "id = ?", req.RoomId).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}

	if slices.Contains(room.Participants, req.UserId) {
		c.JSON(http.StatusOK, gin.H{"status": "Already participant"})
		return
	}

	room.Participants = append(room.Participants, req.UserId)
	config.DB.Save(&room)

	c.JSON(http.StatusOK, gin.H{"status": "Participant added"})
}
