package models

type Room struct {
	ID      string `gorm:"primaryKey"`
	Name    string
	Host    string
	Viewers int
}
