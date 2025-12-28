package models

import "time"

type Live struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Title       string `gorm:"size:200;not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`

	// Foreign keys
	UserID    uint `gorm:"not null;index" json:"user_id"`
	CountryID uint `gorm:"not null;index:idx_live_country_status" json:"country_id"`
	DishID    uint `gorm:"not null;index" json:"dish_id"`

	// Relationships
	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Country Country `gorm:"foreignKey:CountryID" json:"country,omitempty"`
	Dish    Dish    `gorm:"foreignKey:DishID" json:"dish,omitempty"`

	// Metrics (denormalized for performance)
	ViewCount      int `gorm:"default:0;index:idx_live_views" json:"view_count"`
	CurrentViewers int `gorm:"default:0" json:"current_viewers"`
	SearchCount    int `gorm:"default:0" json:"search_count"` // tracks how often this live appears in searches

	// Status
	Status    string     `gorm:"size:20;not null;default:'scheduled';index:idx_live_country_status,idx_live_status" json:"status"` // "scheduled", "live", "ended"
	StartedAt *time.Time `gorm:"index" json:"started_at,omitempty"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`

	// Thumbnails
	ThumbnailURL string `gorm:"size:500" json:"thumbnail_url"`

	CreatedAt time.Time `gorm:"index:idx_live_created" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
