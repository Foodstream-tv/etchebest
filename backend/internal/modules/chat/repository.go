package chat

import (
	"errors"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateChat(db *gorm.DB, chat *Chat) error {
	chat.ID = uuid.New().String()
	if err := db.Create(&chat).Error; err != nil {
		return err
	}
	return nil
}

func GetAllChatsByRoomID(db *gorm.DB, roomID string) ([]GetChat, error) {
	var chats []GetChat
	err := db.Raw(`
		SELECT c.id, u.username, c.message
		FROM chats c
		JOIN users u ON u.id = c.user_id
		WHERE c.room_id = ?
		ORDER BY c.created_at ASC
	`, roomID).Scan(&chats).Error
	if err != nil {
		return nil, err
	}
	return chats, nil
}

func isChatIdInRoom(db *gorm.DB, roomId string, chatId string) (bool, error) {
	var count int64
	if err := db.Model(&Chat{}).Where("id = ? AND room_id = ?", chatId, roomId).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func DeleteChatById(db *gorm.DB, roomId string, chatId string) error {
	exists, err := isChatIdInRoom(db, roomId, chatId)
	if err != nil {
		return errors.New("the room id " + roomId + " does not contain chat " + chatId)
	}
	if !exists {
		return gorm.ErrRecordNotFound
	}
	return db.Delete(&Chat{}, "id = ?", chatId).Error
}
