package user

import (
	"net/http"
	"time"

	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BanRequest struct {
	Reason        string `json:"reason" example:"Inappropriate behavior during a live"`
	DurationHours int    `json:"durationHours" example:"24"` // 0 or omitted = permanent ban
}

type StatusPatch struct {
	IsVerified     *bool   `json:"isVerified"`
	IsFeaturedChef *bool   `json:"isFeaturedChef"`
	Role           *string `json:"role"` // ADMIN or USER
}

// BanUserById godoc
// @Summary      Ban a user
// @Description  Ban a user temporarily (durationHours > 0) or permanently (admin only)
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID"
// @Param        request body user.BanRequest true "Ban details"
// @Success      200  {object}  user.User
// @Failure      400  {object}  map[string]string "error: Invalid JSON"
// @Failure      403  {object}  map[string]string "error: Cannot ban this user"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to ban user"
// @Router       /api/admin/users/{userId}/ban [post]
func BanUserById(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Param("userId")
		currentUserId := utils.GetContextString(c, "userId")

		if userId == currentUserId {
			c.JSON(http.StatusForbidden, gin.H{"error": "you cannot ban yourself"})
			return
		}

		targetUser, err := GetUserByID(db, userId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": errUserNotFound})
			return
		}

		if targetUser.Role == ADMIN {
			c.JSON(http.StatusForbidden, gin.H{"error": "you cannot ban an admin, demote them first"})
			return
		}

		var req BanRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}

		now := time.Now()
		var bannedUntil *time.Time
		if req.DurationHours > 0 {
			until := now.Add(time.Duration(req.DurationHours) * time.Hour)
			bannedUntil = &until
		}

		if err := db.Model(targetUser).Updates(map[string]any{
			"is_banned":    true,
			"ban_reason":   req.Reason,
			"banned_at":    now,
			"banned_until": bannedUntil,
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ban user"})
			return
		}

		c.JSON(http.StatusOK, targetUser)
	}
}

// UnbanUserById godoc
// @Summary      Unban a user
// @Description  Lift an active ban on a user (admin only)
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID"
// @Success      200  {object}  user.User
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to unban user"
// @Router       /api/admin/users/{userId}/unban [post]
func UnbanUserById(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Param("userId")

		targetUser, err := GetUserByID(db, userId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": errUserNotFound})
			return
		}

		if err := ClearBan(db, targetUser); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unban user"})
			return
		}

		c.JSON(http.StatusOK, targetUser)
	}
}

// UpdateUserStatusById godoc
// @Summary      Update a user's status flags
// @Description  Toggle verified / featured chef / role for a user (admin only)
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        userId path string true "User ID"
// @Param        request body user.StatusPatch true "Status fields to update"
// @Success      200  {object}  user.User
// @Failure      400  {object}  map[string]string "error: Invalid JSON or invalid role"
// @Failure      403  {object}  map[string]string "error: Cannot change your own role"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to update user"
// @Router       /api/admin/users/{userId}/status [patch]
func UpdateUserStatusById(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Param("userId")
		currentUserId := utils.GetContextString(c, "userId")

		targetUser, err := GetUserByID(db, userId)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": errUserNotFound})
			return
		}

		var patch StatusPatch
		if err := c.ShouldBindJSON(&patch); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}

		updates := map[string]any{}
		if patch.IsVerified != nil {
			updates["is_verified"] = *patch.IsVerified
		}
		if patch.IsFeaturedChef != nil {
			updates["is_featured_chef"] = *patch.IsFeaturedChef
		}
		if patch.Role != nil {
			if *patch.Role != ADMIN && *patch.Role != USER {
				c.JSON(http.StatusBadRequest, gin.H{"error": "role must be ADMIN or USER"})
				return
			}
			if userId == currentUserId {
				c.JSON(http.StatusForbidden, gin.H{"error": "you cannot change your own role"})
				return
			}
			updates["role"] = *patch.Role
		}

		if len(updates) == 0 {
			c.JSON(http.StatusOK, targetUser)
			return
		}

		if err := db.Model(targetUser).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
			return
		}

		c.JSON(http.StatusOK, targetUser)
	}
}
