package user

import (
	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"net/http"
	"slices"
)

// GetAllUsers godoc
// @Summary      Get all users
// @Description  Retrieve list of all users (admin only)
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {array}   user.User
// @Failure      500  {object}  map[string]string "error: Failed to fetch users"
// @Router       /api/admin/users [get]
func GetAllUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		users, err := GetUsers(db)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
			return
		}

		c.JSON(http.StatusOK, users)
	}
}

// GetMe godoc
// @Summary      Get current user
// @Description  Retrieve the authenticated user's profile
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  user.User
// @Failure      500  {object}  map[string]string "error: Failed to fetch user"
// @Router       /api/users/me [get]
func GetMe(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserId := utils.GetContextString(c, "userId")

		user, err := GetUserByID(db, currentUserId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch user"})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

// DeleteUserById godoc
// @Summary      Delete a user
// @Description  Delete a user by their ID (admin only)
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID"
// @Success      204  "No Content"
// @Failure      500  {object}  map[string]string "error: Failed to delete user"
// @Router       /api/admin/users/{userId} [delete]
func DeleteUserById(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserId := utils.GetContextString(c, "userId")

		if err := DeleteUserByID(db, currentUserId); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		}
		c.Status(http.StatusNoContent)
	}
}

// UpdateUserById godoc
// @Summary      Update a user by ID
// @Description  Update a user's profile by their ID (admin only)
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID"
// @Param        request body user.UserPatch true "Fields to update"
// @Success      200  {object}  user.User
// @Failure      400  {object}  map[string]string "error: Invalid JSON"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to update user"
// @Router       /api/admin/users/{userId} [patch]
func UpdateUserById(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Param("userId")
		updateUser(db, c, userId)
	}
}

// UpdateCurrentUser godoc
// @Summary      Update current user
// @Description  Update the authenticated user's profile
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body user.UserPatch true "Fields to update"
// @Success      200  {object}  user.User
// @Failure      400  {object}  map[string]string "error: Invalid JSON"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to update user"
// @Router       /api/users/me [patch]
func UpdateCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := utils.GetContextString(c, "userId")
		updateUser(db, c, userId)
	}
}

func updateUser(db *gorm.DB, c *gin.Context, userId string) {
	existingUser, err := GetUserByID(db, userId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var patchedUser UserPatch
	if err := c.ShouldBindJSON(&patchedUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	if err := UpdateUser(db, existingUser, patchedUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, existingUser)
}

// FollowUser godoc
// @Summary      Follow a user
// @Description  Follow another user by their ID
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID to follow"
// @Success      200  {object}  map[string]string "message: User followed successfully"
// @Failure      403  {object}  map[string]string "error: You are already following this user"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to save"
// @Router       /api/users/follow/{userId} [post]
func FollowUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userToFollowId := c.Param("userId")

		userToFollow, err := GetUserByID(db, userToFollowId)
		if err != nil {
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

		if err := SaveUser(db, userToFollow); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save user to db"})
			return
		}

		if err := SaveUser(db, currentUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save current user to db"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "user followed successfully"})
	}
}

// UnfollowUser godoc
// @Summary      Unfollow a user
// @Description  Unfollow a user by their ID
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID to unfollow"
// @Success      200  {object}  map[string]string "message: User unfollowed successfully"
// @Failure      400  {object}  map[string]string "error: You are not following this user"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to save"
// @Router       /api/users/unfollow/{userId} [post]
func UnfollowUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userToUnfollowId := c.Param("userId")

		userToUnfollow, err := GetUserByID(db, userToUnfollowId)
		if err != nil {
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

		if err := SaveUser(db, userToUnfollow).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save user to db"})
			return
		}
		if err := SaveUser(db, currentUser).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save current user to db"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "user unfollowed successfully"})
	}
}
