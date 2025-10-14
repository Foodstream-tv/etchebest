package rooms

import (
	"foodstream/config"
	"foodstream/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RoomRequest struct {
	Name string `json:"name" binding:"required"`
}

func CreateRoom(c *gin.Context) {
	var req RoomRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room name is required"})
		return
	}
	var existingRoom models.Room
    if err := config.DB.Where("name = ?", req.Name).First(&existingRoom).Error; err == nil {
        c.JSON(http.StatusOK, gin.H{"roomId": existingRoom.ID, "message": "Room joined"})
        return
    }
	userId, _ := c.Get("userId")
	host := "" // temporary until middleware with jwt
	if userId != nil {
		host = userId.(string)
	}

	room := models.Room{
		ID:      uuid.New().String(),
		Name:    req.Name,
		Host:    host,
		Viewers: 0,
	}

	if err := config.DB.Create(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"roomId": room.ID, "message": "Room created"})
}

func GetRooms(c *gin.Context) {
	var rooms []models.Room

	if err := config.DB.Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rooms": rooms})
}
