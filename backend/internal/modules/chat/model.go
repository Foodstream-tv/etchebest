package chat

import "time"

type Chat struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId"`
	RoomID    string    `json:"roomId"`
	Message   string    `json:"message" binding:"required" gorm:"type:varchar(500);not null"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index"`
}

// MaxMessageLength is the size of the message column (characters).
const MaxMessageLength = 500

type PostChat struct {
	Message *string `json:"message" binding:"required,max=500"`
}

type GetChat struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Message  string `json:"message"`
}
