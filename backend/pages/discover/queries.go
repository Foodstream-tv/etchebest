package discover

import (
	"fmt"
	"strings"
	"time"

	"github.com/Foodstream-io/etchebest/dto"
	"github.com/Foodstream-io/etchebest/mappers"
	"github.com/Foodstream-io/etchebest/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type dishWithStatsRow struct {
	models.Dish
	TotalViews int
	LiveCount  int
}

type DishWithStats struct {
	dto.DishDTO
	TotalViews int `json:"total_views"`
	LiveCount  int `json:"live_count"`
}

type CategoryWithCountRow struct {
	models.Country
	LiveCount int
}

type CategoryWithCount struct {
	dto.CountryDTO
	LiveCount int `json:"live_count"`
}

func getTrendingCountry(db *gorm.DB) (*dto.CountryDTO, error) {
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
		Where("status = ?", models.LiveStatusLive).
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

	dtoCountry := mappers.CountryToDTO(country)

	return &dtoCountry, nil
}

func getTopDishes(db *gorm.DB, limit int) ([]DishWithStats, error) {
	var rows []dishWithStatsRow

	err := db.Model(&models.Dish{}).
		Select(`
            dishes.*,
            COALESCE(SUM(lives.view_count), 0) as total_views,
            COUNT(CASE WHEN lives.status = '`+models.LiveStatusLive+`' THEN 1 END) as live_count
        `).
		Joins("LEFT JOIN lives ON lives.dish_id = dishes.id").
		Where("dishes.is_active = ?", true).
		Group("dishes.id").
		Order("total_views DESC").
		Limit(limit).
		Scan(&rows).Error

	if err != nil {
		return nil, err
	}

	// Preload country for each dish
	for i := range rows {
		db.Model(&rows[i]).Association("Country").Find(&rows[i].Country)
	}

	dishes := make([]DishWithStats, 0, len(rows))
	for _, r := range rows {
		dishes = append(dishes, DishWithStats{
			DishDTO:    mappers.DishToDTO(r.Dish),
			TotalViews: r.TotalViews,
			LiveCount:  r.LiveCount,
		})
	}

	return dishes, nil
}

func applyFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	// Get all filters from query params
	// Format: ?filters[status]=live&filters[dish_id]=5

	if status := c.Query("filters[status]"); status != "" {
		validStatuses := map[string]bool{models.LiveStatusScheduled: true, models.LiveStatusLive: true, models.LiveStatusEnded: true}
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
	case models.SortViews:
		return query.Order("view_count DESC")
	case models.SortViewers:
		return query.Order("current_viewers DESC")
	case models.SortRecent:
		return query.Order("created_at DESC")
	case models.SortOldest:
		return query.Order("created_at ASC")
	default:
		return query.Order("CASE WHEN status = 'live' THEN 0 ELSE 1 END, current_viewers DESC")
	}
}
