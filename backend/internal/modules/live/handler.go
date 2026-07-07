package live

import (
	"net/http"
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
		q := c.Query("q")
		tagName := c.Query("tag")
		status := c.Query("status")

		page := 1
		limit := 20

		if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
			page = p
		}

		if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 100 {
			limit = l
		}

		offset := (page - 1) * limit

		query := db.Model(&Live{}).
			Preload("User").
			Preload("Dish").
			Preload("Country").
			Preload("Tags")

		if status != "" && status != "all" {
			query = query.Where("status = ?", status)
		} else {
			query = query.Where("status IN ?", []string{"scheduled", "live"})
		}

		if q != "" {
			like := "%" + q + "%"
			query = query.Where(
				"title ILIKE ? OR description ILIKE ? OR dish_name ILIKE ?",
				like,
				like,
				like,
			)
		}

		if tagName != "" && tagName != "Tout" {
			query = query.
				Joins("JOIN live_tags ON live_tags.live_id = lives.id").
				Joins("JOIN tags ON tags.id = live_tags.tag_id").
				Where("tags.name = ?", tagName)
		}

		var total int64
		if err := query.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count lives"})
			return
		}

		var lives []Live
		if err := query.
			Order("COALESCE(scheduled_at, created_at) ASC").
			Limit(limit).
			Offset(offset).
			Find(&lives).Error; err != nil {
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
