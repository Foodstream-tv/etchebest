package models

import "time"

type Tag struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Slug      string    `gorm:"size:100;not null;uniqueIndex" json:"slug"`
	ImageURL  string    `gorm:"size:500" json:"image_url"`
	Color     string    `gorm:"size:20" json:"color"`
	IsActive  bool      `gorm:"default:true;index" json:"is_active"`
	LiveCount int       `gorm:"default:0" json:"live_count"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
