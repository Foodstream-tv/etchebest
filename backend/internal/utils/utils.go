package utils

import (
	"errors"

	"github.com/Foodstream-io/etchebest/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetUserByID(db *gorm.DB, userID string) (*models.User, error) {
	var user models.User
	if err := db.First(&user, userID).Error; err != nil {
		return nil, errors.New("authenticated user not found in database")
	}
	return &user, nil
}

func GetContextString(c *gin.Context, key string) string {
	res, _ := c.Get(key)
	return res.(string)
}
