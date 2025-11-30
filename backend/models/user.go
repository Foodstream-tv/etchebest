package models

import "gorm.io/gorm"

const (
	ADMIN = "ADMIN"
	USER  = "USER"
)

type User struct {
	ID           string   `gorm:"primaryKey"`
	Email        string   `gorm:"unique;not null"`
	Password     string   `gorm:"not null"`
	Role         string   `gorm:"not null"`
	FollowingIDS []string `gorm:"type:text[]"`
	FollowerIDS  []string `gorm:"type:text[]"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	u.Role = USER
	return nil
}
