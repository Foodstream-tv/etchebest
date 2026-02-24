package models

import "time"

type Dish struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:200;not null;index" json:"name"`
	CountryID   *uint     `gorm:"not null;index" json:"country_id,omitempty"`
	Country     *Country  `gorm:"foreignKey:CountryID" json:"country"`
	ImageURL    string    `gorm:"size:500" json:"image_url"`
	Description string    `gorm:"type:text" json:"description"`
	IsActive    bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
