package models

type User struct {
	ID       string `gorm:"primaryKey"`
	Email    string `gorm:"unique;not null"`
	Password string `gorm:"not null"`
}
