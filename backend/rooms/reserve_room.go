package rooms

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/config"
	"github.com/Foodstream-io/etchebest/models"

	"github.com/gin-gonic/gin"
)

/*
ReserveRoom godoc
@Summary      Reserve a spot in a room
@Description  Reserve a participant slot in a room in advance
@Tags         rooms
@Accept       json
@Produce      json
@Security     BearerAuth
@Param        request body object{roomId=string} true "Room ID to reserve"
@Success      200  {object}  map[string]string "message: Reserved successfully or Already reserved"
@Failure      400  {object}  map[string]string "error: RoomID is required"
@Failure      401  {object}  map[string]string "error: Unauthorized"
@Failure      403  {object}  map[string]string "error: Room full, cannot reserve"
@Failure      404  {object}  map[string]string "error: Room not found"
@Failure      500  {object}  map[string]string "error: Failed to save reservation"
@Router       /reserve [post]
*/
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
