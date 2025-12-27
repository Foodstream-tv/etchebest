package users

import (
	"github.com/Foodstream-io/etchebest/models"
	"github.com/Foodstream-io/etchebest/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
	"slices"
)

func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User

		if err := db.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}

		c.JSON(http.StatusOK, users)
	}
}

func GetMe(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User

		if err := db.First(&user, c.Param("userId")).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user"})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

func UpdateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userPatch models.UserPatch

		userId := c.Query("userId")
		if userId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId parameter is required"})
			return
		}

		var existingUser models.User
		if err := db.Where("id = ?", userId).First(&existingUser).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		if err := c.ShouldBindJSON(&userPatch); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
			return
		}

		if err := db.Model(&existingUser).Updates(&userPatch).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}

		var updatedUser models.User
		if err := db.Where("id = ?", userId).First(&updatedUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated user"})
			return
		}

		c.JSON(http.StatusOK, updatedUser)
	}
}

func FollowUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userToFollow models.User

		userToFollowId := c.Query("userId")
		if userToFollowId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId parameter is required"})
			return
		}

		if err := db.Where("id = ?", userToFollowId).First(&userToFollow).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "couldn't find the user you are trying to follow"})
			return
		}

		currentUser, err := utils.GetCurrentUser(db, c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get current user"})
			return
		}
		if slices.Contains(currentUser.FollowingIDS, userToFollowId) {
			c.JSON(http.StatusForbidden, gin.H{"error": "you are already following this user"})
			return
		}
		currentUser.FollowingIDS = append(currentUser.FollowingIDS, userToFollowId)
		userToFollow.FollowersIDS = append(userToFollow.FollowersIDS, currentUser.ID)

		if err := db.Save(&userToFollow).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save user to db"})
			return
		}
		if err := db.Save(&currentUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save current user to db"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "user followed successfully"})
	}
}

func UnfollowUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userToUnfollow models.User

		userToUnfollowId := c.Query("userId")
		if userToUnfollowId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId parameter is required"})
			return
		}

		if err := db.Where("id = ?", userToUnfollowId).First(&userToUnfollow).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "couldn't find the user you are trying to unfollow"})
			return
		}

		currentUser, err := utils.GetCurrentUser(db, c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get current user"})
			return
		}
		if !slices.Contains(currentUser.FollowingIDS, userToUnfollowId) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "you are not following this user, this action is not possible"})
			return
		}

		indexUserToUnfollow := slices.Index(currentUser.FollowingIDS, userToUnfollowId)
		currentUser.FollowingIDS = append(currentUser.FollowingIDS[:indexUserToUnfollow], currentUser.FollowingIDS[indexUserToUnfollow+1:]...)

		indexFollowerToRemove := slices.Index(userToUnfollow.FollowersIDS, currentUser.ID)
		userToUnfollow.FollowersIDS = append(userToUnfollow.FollowersIDS[:indexFollowerToRemove], userToUnfollow.FollowersIDS[indexFollowerToRemove+1:]...)

		if err := db.Save(&userToUnfollow).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save user to db"})
			return
		}
		if err := db.Save(&currentUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save current user to db"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "user unfollowed successfully"})
	}
}
