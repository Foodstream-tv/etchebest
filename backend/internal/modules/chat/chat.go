package chat

import (
	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
)

// GetAllChatsByRoom godoc
// @Summary      Get all chats for a room
// @Description  Retrieve list of all chats in a stream
// @Tags         rooms chats
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}   chat.Chat
// @Failure      500  {object}  map[string]string "error: failed to get chats from room id {roomId}"
// @Router       /api/rooms/{roomId}/chats [get]
func GetAllChatsByRoom(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")
		chats, err := GetAllChatsByRoomID(db, roomID)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get chats from room id " + roomID})
			return
		}
		c.JSON(http.StatusOK, chats)
	}
}

// CreateNewChat godoc
// @Summary      Create chat
// @Description  Posts a new chat to the room
// @Tags         rooms chats
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}   chat.Chat
// @Failure      500  {object}  map[string]string "error: failed to create a chat"
// @Router       /api/rooms/{roomId}/chats [get]
func CreateNewChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var postChat PostChat
		if err := c.ShouldBindJSON(&postChat); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to post a chat"})
			return
		}

		var chat Chat
		roomID := c.Param("roomId")
		userId := utils.GetContextString(c, "userId")

		chat.Message = *postChat.Message
		chat.UserID = userId
		chat.RoomID = roomID

		if err := CreateChat(db, &chat); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err})
			return
		}
	}
}

// DeleteChat godoc
// @Summary      Delete chat
// @Description  Deletes a chat by it's ID
// @Tags         rooms chats
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200
// @Failure      500  {object}  map[string]string "the room id {roomId} does not contain chat {chatId}"
// @Failure		 500  {object}  map[string]string "ErrRecordNotFound record not found error"
// @Router       /api/rooms/{roomId}/chats [get]
func DeleteChat(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatId := c.Param("chatId")
		roomId := c.Param("roomId")

		err := DeleteChatById(db, roomId, chatId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "successfully deleted chat"})
	}
}
