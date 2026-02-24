package repository

import (
	"github.com/Foodstream-io/etchebest/internal/models"
	"gorm.io/gorm"
)

func CreateRoom(db *gorm.DB, room *models.Room) error {
	if err := db.Create(&room).Error; err != nil {
		return err
	}
	return nil
}

func SaveRoom(db *gorm.DB, room *models.Room) error {
	if err := db.Save(room).Error; err != nil {
		return err
	}
	return nil
}

func GetRooms(db *gorm.DB) ([]models.Room, error) {
	var rooms []models.Room

	if err := db.Find(&rooms).Error; err != nil {
		return rooms, err
	}

	return rooms, nil
}

func GetRoomById(db *gorm.DB, id string) (*models.Room, error) {
	var room models.Room

	if err := db.First(&room, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &room, nil
}

func DeleteRoomById(db *gorm.DB, id string) error {
	if err := db.Delete(&models.Room{}, "id = ?", id).Error; err != nil {
		return err
	}
	return nil
}
