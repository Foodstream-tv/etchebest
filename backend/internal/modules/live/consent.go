package live

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RecordingConsent proves that a co-streamer agreed to take part in a live that is recorded and may be
// replayed. One row per (room, user): it is created when the person reserves a place.
type RecordingConsent struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	RoomID      string    `gorm:"size:100;not null;uniqueIndex:idx_consent_room_user" json:"roomId"`
	UserID      string    `gorm:"size:100;not null;uniqueIndex:idx_consent_room_user;index" json:"userId"`
	ConsentedAt time.Time `gorm:"not null" json:"consentedAt"`
}

// RecordConsent stores the consent of userID for the room (idempotent: the first date is kept).
func RecordConsent(db *gorm.DB, roomID, userID string, at time.Time) error {
	return db.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&RecordingConsent{RoomID: roomID, UserID: userID, ConsentedAt: at}).Error
}

// HasConsented reports whether userID already agreed to the recording of the room.
func HasConsented(db *gorm.DB, roomID, userID string) (bool, error) {
	var n int64
	err := db.Model(&RecordingConsent{}).Where("room_id = ? AND user_id = ?", roomID, userID).Count(&n).Error
	return n > 0, err
}

// IsRecorded reports whether the live of the room is kept as a replay. A room without a live row is
// treated as recorded (the safe side for the people in it).
func IsRecorded(db *gorm.DB, roomID string) bool {
	var l Live
	if err := db.Select("replay_disabled").Where("room_id = ?", roomID).First(&l).Error; err != nil {
		return true
	}
	return !l.ReplayDisabled
}
