package activity

import (
	"net/http"
	"strconv"

	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetMyActivities(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserID := utils.GetContextString(c, "userId")

		days, err := strconv.Atoi(c.DefaultQuery("days", "30"))
		if err != nil {
			days = 30
		}

		activities, err := GetRecentActivities(db, currentUserID, days)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to fetch activities",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"activities": activities,
		})
	}
}