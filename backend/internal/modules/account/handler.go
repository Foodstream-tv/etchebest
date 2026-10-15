package account

import (
	"errors"
	"log"
	"net/http"

	"github.com/Foodstream-io/etchebest/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ExportMe godoc
// @Summary      Export my data
// @Description  Download everything the platform holds about the authenticated user (GDPR access and portability)
// @Tags         users
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  account.Export
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to export data"
// @Router       /api/users/me/export [get]
func ExportMe(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := utils.GetContextString(c, "userId")
		data, err := BuildExport(db, userID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			log.Printf("[EXPORT] failed for user %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to export data"})
			return
		}
		c.Header("Content-Disposition", `attachment; filename="foodstream-my-data.json"`)
		c.JSON(http.StatusOK, data)
	}
}

// DeleteCurrentUser godoc
// @Summary      Delete current user
// @Description  Erase the authenticated user's account and all their personal data
// @Tags         users
// @Security     BearerAuth
// @Success      204  "No Content"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to delete user"
// @Router       /api/users/me [delete]
func DeleteCurrentUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		erase(c, db, utils.GetContextString(c, "userId"))
	}
}

// DeleteUserById godoc
// @Summary      Delete a user
// @Description  Erase a user and all their personal data (admin only)
// @Tags         users
// @Security     BearerAuth
// @Param        userId path string true "User ID"
// @Success      204  "No Content"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Failed to delete user"
// @Router       /api/admin/users/{userId} [delete]
func DeleteUserById(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		erase(c, db, c.Param("userId"))
	}
}

func erase(c *gin.Context, db *gorm.DB, userID string) {
	if err := EraseUser(db, userID); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		log.Printf("[ERASE] failed for user %s: %v", userID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}
	c.Status(http.StatusNoContent)
}
