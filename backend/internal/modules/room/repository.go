package room

import (
	"gorm.io/gorm"
)

func CreateRoom(db *gorm.DB, room *Room) error {
	if err := db.Create(&room).Error; err != nil {
		return err
	}
	return nil
}

func SaveRoom(db *gorm.DB, room *Room) error {
	if err := db.Save(room).Error; err != nil {
		return err
	}
	return nil
}

func GetRooms(db *gorm.DB) ([]Room, error) {
	var rooms []Room

	if err := db.Find(&rooms).Error; err != nil {
		return rooms, err
	}

	return rooms, nil
}

func GetRoomById(db *gorm.DB, id string) (*Room, error) {
	var room Room

	if err := db.First(&room, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &room, nil
}

func DeleteRoomById(db *gorm.DB, id string) error {
	if err := db.Delete(&Room{}, "id = ?", id).Error; err != nil {
		return err
	}
	return nil
}
