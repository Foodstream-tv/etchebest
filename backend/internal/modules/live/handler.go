package live

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type GetLivesResponse struct {
	Lives []LiveDTO `json:"lives"`
	Total int64     `json:"total"`
	Page  int       `json:"page"`
	Limit int       `json:"limit"`
}

func GetLives(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, limit := getLivesPagination(c)
		offset := (page - 1) * limit
		query := livesQuery(db, c)

		var total int64
		if err := query.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count lives"})
			return
		}

		lives, err := fetchLives(query, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch lives"})
			return
		}

		liveDTOs := make([]LiveDTO, 0, len(lives))
		for _, item := range lives {
			liveDTOs = append(liveDTOs, LiveToDTO(item))
		}

		c.JSON(http.StatusOK, GetLivesResponse{
			Lives: liveDTOs,
			Total: total,
			Page:  page,
			Limit: limit,
		})
	}
}

func getLivesPagination(c *gin.Context) (int, int) {
	page, limit := 1, 20
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 100 {
		limit = l
	}
	return page, limit
}

func livesQuery(db *gorm.DB, c *gin.Context) *gorm.DB {
	query := db.Model(&Live{}).
		Preload("User").Preload("Dish").Preload("Country").Preload("Tags")
	status := c.Query("status")
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	} else {
		query = query.Where("status IN ?", []string{"scheduled", "live"})
	}
	if q := c.Query("q"); q != "" {
		like := "%" + q + "%"
		query = query.Where("title ILIKE ? OR description ILIKE ? OR dish_name ILIKE ?", like, like, like)
	}
	// Accepts repeated params (?tag=A&tag=B): a live matches if it has any of the tags.
	if tagNames := getTagFilters(c); len(tagNames) > 0 {
		query = query.Where(
			"lives.id IN (SELECT live_tags.live_id FROM live_tags JOIN tags ON tags.id = live_tags.tag_id WHERE tags.name IN ?)",
			tagNames,
		)
	}
	return query
}

func getTagFilters(c *gin.Context) []string {
	tagNames := make([]string, 0)
	for _, tagName := range c.QueryArray("tag") {
		if tagName != "" && tagName != "Tout" {
			tagNames = append(tagNames, tagName)
		}
	}
	return tagNames
}

func fetchLives(query *gorm.DB, limit, offset int) ([]Live, error) {
	var lives []Live
	err := query.Order("COALESCE(scheduled_at, created_at) ASC").Limit(limit).Offset(offset).Find(&lives).Error
	return lives, err
}

func GetLiveByRoomID(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")

		var live Live

		if err := db.
			Preload("User").
			Preload("Tags").
			Where("room_id = ?", roomID).
			First(&live).Error; err != nil {

			c.JSON(http.StatusNotFound, gin.H{
				"error": "live not found",
			})
			return
		}

		c.JSON(http.StatusOK, LiveToDTO(live))
	}
}

// GetMyScheduledLive returns the current user's pending scheduled live
// (room id, title and scheduled time), or {"live": null} if none exists.
func GetMyScheduledLive(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userId")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		// Limit(1).Find évite le log "record not found" de GORM :
		// l'absence de live planifié est un cas normal, pas une erreur.
		var scheduled []Live
		if err := db.
			Where("user_id = ? AND status = ?", userID, "scheduled").
			Order("COALESCE(scheduled_at, created_at) ASC").
			Limit(1).
			Find(&scheduled).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch scheduled live"})
			return
		}

		if len(scheduled) == 0 {
			c.JSON(http.StatusOK, gin.H{"live": nil})
			return
		}

		c.JSON(http.StatusOK, gin.H{"live": gin.H{
			"room_id":      scheduled[0].RoomID,
			"title":        scheduled[0].Title,
			"scheduled_at": scheduled[0].ScheduledAt,
		}})
	}
}

// DeleteLive deletes a live or replay owned by the authenticated user
func DeleteLive(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idParam := c.Param("id")
		currentUserID := c.GetString("userId")
		if currentUserID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var targetLive Live
		var err error
		if numericID, parseErr := strconv.Atoi(idParam); parseErr == nil {
			err = db.Where("id = ?", numericID).First(&targetLive).Error
		} else {
			err = db.Where("room_id = ?", idParam).First(&targetLive).Error
		}

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "live or replay not found"})
			return
		}

		// Only the owner of the live/replay can delete it
		if targetLive.UserID != currentUserID {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only delete your own replays"})
			return
		}

		// Clear tag associations
		_ = db.Model(&targetLive).Association("Tags").Clear()

		// Delete record from DB
		if err := db.Delete(&targetLive).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete replay"})
			return
		}

		// Clean up HLS replay files on disk asynchronously
		if targetLive.RoomID != "" {
			go func(roomID string) {
				replayDir := filepath.Join("./storage/replays", roomID)
				_ = os.RemoveAll(replayDir)
			}(targetLive.RoomID)
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "replay deleted successfully",
			"id":      targetLive.ID,
			"roomId":  targetLive.RoomID,
		})
	}
}

