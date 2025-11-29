package rooms

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/models"
	"github.com/lib/pq"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoomRequest struct {
	Name string `json:"name" binding:"required" example:"My Cooking Stream"`
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
		userId, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		host := userId.(string)

		room := models.Room{
			ID:              uuid.New().String(),
			Name:            req.Name,
			Host:            host,
			Participants:    pq.StringArray{host},
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

		c.JSON(http.StatusOK, gin.H{"rooms": rooms})
	}
}
