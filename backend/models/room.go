package models

import (
	"github.com/lib/pq"
)

type Room struct {
	ID              string         `json:"id" gorm:"primaryKey"`
	Name            string         `json:"name"`
	Host            string         `json:"host"`
	Participants    pq.StringArray `json:"participants" gorm:"type:text[]"`
	Viewers         int            `json:"viewers"`
	MaxParticipants int            `json:"maxParticipants" gorm:"default:5"`
}
