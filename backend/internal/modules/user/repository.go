package user

import (
	"gorm.io/gorm"
)

func GetUsers(db *gorm.DB) ([]User, error) {
	var users []User

	if err := db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func GetUserByID(db *gorm.DB, id string) (*User, error) {
	var tmpUser User

	if err := db.First(&tmpUser, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &tmpUser, nil
}

func DeleteUserByID(db *gorm.DB, id string) error {
	if err := db.Delete(&User{}, "id = ?", id).Error; err != nil {
		return err
	}
	return nil
}

func UpdateUser(db *gorm.DB, existingUser *User, patchedUser UserPatch) error {
	if err := db.Model(&existingUser).Updates(&patchedUser).Error; err != nil {
		return err
	}
	return nil
}

func SaveUser(db *gorm.DB, newUser *User) error {
	if err := db.Save(&newUser).Error; err != nil {
		return err
	}
	return nil
}
