package models

import (
	"github.com/lib/pq"
)

type Room struct {
	ID              string `gorm:"primaryKey"`
	Name            string
	Host            string
	Participants    pq.StringArray `gorm:"type:text[]"`
	Viewers         int
	MaxParticipants int `gorm:"default:5"`
}
