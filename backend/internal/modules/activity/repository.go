package activity

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateFollowActivity(db *gorm.DB, userID string, actorID string, actorName string) error {
	text := actorName + " a commencé à vous suivre."

	activity := Activity{
		ID:        uuid.NewString(),
		UserID:    userID,
		ActorID:   actorID,
		Type:      TypeFollow,
		Text:      text,
		CreatedAt: time.Now(),
	}

	return db.Create(&activity).Error
}

func DeleteFollowActivity(db *gorm.DB, userID string, actorID string) error {
	return db.
		Where("user_id = ? AND actor_id = ? AND type = ?", userID, actorID, TypeFollow).
		Delete(&Activity{}).
		Error
}

func GetRecentActivities(db *gorm.DB, userID string, days int) ([]Activity, error) {
	if days <= 0 {
		days = 30
	}

	since := time.Now().AddDate(0, 0, -days)

	var activities []Activity

	err := db.
		Where("user_id = ? AND created_at >= ?", userID, since).
		Order("created_at DESC").
		Find(&activities).
		Error

	return activities, err
}