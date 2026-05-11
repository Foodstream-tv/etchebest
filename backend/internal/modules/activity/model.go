package activity

import "time"

const (
	TypeFollow = "follow"
)

type Activity struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`  // one's that recieve activity
	ActorID   string    `gorm:"index;not null" json:"actor_id"` // one's doing the action
	Type      string    `gorm:"size:50;index;not null" json:"type"`
	Text      string    `gorm:"size:500;not null" json:"text"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}