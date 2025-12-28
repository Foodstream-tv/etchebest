// discover/queries.go
package discover

import (
	"fmt"
	"strings"
	"time"

	"github.com/Foodstream-io/etchebest/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DishWithStats struct {
	models.Dish
	TotalViews int `json:"total_views"`
	LiveCount  int `json:"live_count"`
}

type CategoryWithCount struct {
	models.Country
	LiveCount int `json:"live_count"`
}

func getTrendingCountry(db *gorm.DB) (*models.Country, error) {
	type CountryScore struct {
		CountryID uint
		Score     float64
	}

	var result CountryScore

	// Score calculation:
	// - Current viewers: weight 3
	// - Total views in last 24h: weight 2
	// - Search count in last 24h: weight 1
	oneDayAgo := time.Now().Add(-24 * time.Hour)

	err := db.Model(&models.Live{}).
		Select(`
            country_id,
            (SUM(current_viewers) * 3 + 
             SUM(CASE WHEN created_at > ? THEN view_count ELSE 0 END) * 2 + 
             SUM(CASE WHEN created_at > ? THEN search_count ELSE 0 END)) as score
        `, oneDayAgo, oneDayAgo).
		Where("status = ?", "live").
		Group("country_id").
		Order("score DESC").
		Limit(1).
		Scan(&result).Error

	if err != nil {
		return nil, err
	}

	var country models.Country
	if err := db.First(&country, result.CountryID).Error; err != nil {
		return nil, err
	}

	return &country, nil
}

func getTopDishes(db *gorm.DB, limit int) ([]DishWithStats, error) {
	var dishes []DishWithStats

	err := db.Model(&models.Dish{}).
		Select(`
            dishes.*,
            COALESCE(SUM(lives.view_count), 0) as total_views,
            COUNT(CASE WHEN lives.status = 'live' THEN 1 END) as live_count
        `).
		Joins("LEFT JOIN lives ON lives.dish_id = dishes.id").
		Where("dishes.is_active = ?", true).
		Group("dishes.id").
		Order("total_views DESC").
		Limit(limit).
		Scan(&dishes).Error

	if err != nil {
		return nil, err
	}

	// Preload country for each dish
	for i := range dishes {
		db.Model(&dishes[i]).Association("Country").Find(&dishes[i].Country)
	}

	return dishes, nil
}

func applyFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	// Get all filters from query params
	// Format: ?filters[status]=live&filters[dish_id]=5

	if status := c.Query("filters[status]"); status != "" {
		validStatuses := map[string]bool{"scheduled": true, "live": true, "ended": true}
		if validStatuses[status] {
			query = query.Where("status = ?", status)
		}
	}

	if dishID := c.Query("filters[dish_id]"); dishID != "" {
		query = query.Where("dish_id = ?", dishID)
	}

	if minViewers := c.Query("filters[min_viewers]"); minViewers != "" {
		query = query.Where("current_viewers >= ?", minViewers)
	}

	if hoursAgo := c.Query("filters[hours_ago]"); hoursAgo != "" {
		var hours int
		if _, err := fmt.Sscanf(hoursAgo, "%d", &hours); err == nil && hours > 0 {
			cutoff := time.Now().Add(-time.Duration(hours) * time.Hour)
			query = query.Where("started_at >= ?", cutoff)
		}
	}

	return query
}

func applySorting(query *gorm.DB, sortParam string) *gorm.DB {
	switch strings.ToLower(sortParam) {
	case "views":
		return query.Order("view_count DESC")
	case "viewers":
		return query.Order("current_viewers DESC")
	case "recent", "recency":
		return query.Order("created_at DESC")
	case "oldest":
		return query.Order("created_at ASC")
	default:
		return query.Order("CASE WHEN status = 'live' THEN 0 ELSE 1 END, current_viewers DESC")
	}
}
