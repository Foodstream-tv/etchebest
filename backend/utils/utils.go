package utils

import (
	"errors"
	"github.com/Foodstream-io/etchebest/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetCurrentUser(db *gorm.DB, c *gin.Context) (*models.User, error) {
	var user models.User

	if err := db.First(&user, c.Param("userId")).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return &user, nil
}
