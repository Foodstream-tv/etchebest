package user

import (
	"gorm.io/gorm"
)

func GetUserByID(db *gorm.DB, userID string) (*User, error) {
	var tmpUser User

	if err := db.First(&tmpUser, userID).Error; err != nil {
		return nil, err
	}
	return &tmpUser, nil
}
