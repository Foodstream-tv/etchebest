package models

import (
	"github.com/lib/pq"
	"gorm.io/gorm"
	"time"
)

const (
	ADMIN = "ADMIN"
	USER  = "USER"
)

type User struct {
	ID                 string         `json:"id" gorm:"primaryKey"`
	Email              string         `json:"email" gorm:"unique;not null"`
	Password           string         `json:"-" gorm:"not null"`
	FirstName          string         `json:"firstName"`
	LastName           string         `json:"lastName"`
	Username           string         `json:"username"`
	ProfileImageURL    string         `json:"profileImageUrl"`
	Description        string         `json:"description"`
	CreatedAt          time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt          time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
	CountryNumberPhone int            `json:"countryNumberPhone"`
	NumberPhone        string         `json:"numberPhone"`
	Role               string         `json:"role" gorm:"not null"`
	FollowingIDS       pq.StringArray `json:"followingIds" gorm:"type:text[]"`
	FollowersIDS       pq.StringArray `json:"followersIds " gorm:"type:text[]"`
}

type UserPatch struct {
	Email              *string    `json:"email"`
	Password           *string    `json:"-"`
	FirstName          *string    `json:"firstName"`
	LastName           *string    `json:"lastName"`
	Username           *string    `json:"username"`
	ProfileImageURL    *string    `json:"profileImageUrl"`
	Description        *string    `json:"description"`
	CountryNumberPhone *int       `json:"countryNumberPhone"`
	NumberPhone        *string    `json:"numberPhone"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	u.Role = USER
	return nil
}
