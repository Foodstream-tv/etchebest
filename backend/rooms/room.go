package rooms

import (
	"foodstream/config"
	"log"
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
	userId, _ := c.Get("userId")
	roomID := uuid.New().String()

	_, _, err := config.FirestoreClient.Collection("rooms").Add(c, map[string]any{
		"name":    req.Name,
		"host":    userId,
		"roomId":  roomID,
		"viewers": 0,
	})

	if err != nil {
		log.Printf("Firestore Add error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"roomId": roomID, "message": "Room created"})
}

func GetRooms(c *gin.Context) {
	rooms := []map[string]any{}
	iters, err := config.FirestoreClient.Collection("rooms").Documents(c).GetAll()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	for _, iter := range iters {
		rooms = append(rooms, iter.Data())
	}
	c.JSON(http.StatusOK, gin.H{"rooms": rooms})
}
