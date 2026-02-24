package user

import (
	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
	"slices"
)

func GetUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []User

		if err := db.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
			return
		}

		c.JSON(http.StatusOK, users)
	}
}

func GetMe(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user User

		currentUserId := utils.GetContextString(c, "userId")

		if err := db.First(&user, currentUserId).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}
func UpdateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Param("userId")
		updateUser(db, c, userId)
	}
}

func UpdateCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := utils.GetContextString(c, "userId")
		updateUser(db, c, userId)
	}
}

func updateUser(db *gorm.DB, c *gin.Context, userId string) {
	var existingUser User
	if err := db.Where("id = ?", userId).First(&existingUser).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var userPatch UserPatch
	if err := c.ShouldBindJSON(&userPatch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	if err := db.Model(&existingUser).Updates(&userPatch).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, existingUser)
}

func FollowUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userToFollow User

		userToFollowId := c.Param("userId")
		if err := db.Where("id = ?", userToFollowId).First(&userToFollow).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "couldn't find the user you are trying to follow"})
			return
		}

		currentUserId := utils.GetContextString(c, "userId")
		currentUser, err := GetUserByID(db, currentUserId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "failed to get current user"})
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
		var userToUnfollow User

		userToUnfollowId := c.Param("userId")
		if err := db.Where("id = ?", userToUnfollowId).First(&userToUnfollow).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "couldn't find the user you are trying to unfollow"})
			return
		}

		currentUserId := utils.GetContextString(c, "userId")
		currentUser, err := GetUserByID(db, currentUserId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user " + "currentUserId" + " not found"})
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
