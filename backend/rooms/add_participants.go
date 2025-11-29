package rooms

import (
	"gorm.io/gorm"
	"net/http"
	"slices"

	"github.com/Foodstream-io/etchebest/models"

	"github.com/gin-gonic/gin"
)

type AddParticipantReq struct {
	RoomId string `json:"roomId" binding:"required" example:"550e8400-e29b-41d4-a716-446655440000"`
	UserId string `json:"userId" binding:"required" example:"550e8400-e29b-41d4-a716-446655440001"`
}

/*
AddParticipant godoc
@Summary      Add participant to room
@Description  Add a user as a participant to a specific room
@Tags         rooms
@Accept       json
@Produce      json
@Security     BearerAuth
@Param        request body AddParticipantReq true "Room and user IDs"
@Success      200  {object}  map[string]string "status: Participant added or Already participant"
@Failure      400  {object}  map[string]string "error: Invalid body"
@Failure      401  {object}  map[string]string "error: Unauthorized"
@Failure      404  {object}  map[string]string "error: Room not found"
@Router       /addParticipant [post]
*/
func AddParticipant(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AddParticipantReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
			return
		}

		var room models.Room
		if err := db.First(&room, "id = ?", req.RoomId).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}

		if slices.Contains(room.Participants, req.UserId) {
			c.JSON(http.StatusOK, gin.H{"status": "Already participant"})
			return
		}

		room.Participants = append(room.Participants, req.UserId)
		db.Save(&room)

		c.JSON(http.StatusOK, gin.H{"status": "Participant added"})
	}
}
