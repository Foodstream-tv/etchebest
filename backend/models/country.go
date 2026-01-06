package models

import "time"

type Country struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Code      string    `gorm:"size:10;not null;uniqueIndex" json:"code"` // e.g., "US", "FR"
	ImageURL  string    `gorm:"size:500" json:"image_url"`
	IsActive  bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
