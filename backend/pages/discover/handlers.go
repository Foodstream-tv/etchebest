package discover

import (
	"net/http"
	"strconv"

	"github.com/Foodstream-io/etchebest/internal/httpx"
	"github.com/Foodstream-io/etchebest/mappers"
	"github.com/Foodstream-io/etchebest/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetDiscoverHome godoc
// @Summary Discover home
// @Description Returns trending country, top dishes and categories
// @Tags Discover
// @Produce json
// @Success 200 {object} DiscoverHomeResponse
// @Failure 500 {object} map[string]string
// @Router /api/discover [get]
func GetDiscoverHome(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var response DiscoverHomeResponse

		trendingCountry, err := getTrendingCountry(db)
		if err != nil {
			httpx.InternalError(c, "failed to fetch trending country")
			return
		}
		response.TrendingCountry = trendingCountry

		topDishes, err := getTopDishes(db, 3)
		if err != nil {
			httpx.InternalError(c, "failed to fetch top dishes")
			return
		}
		response.TopDishes = topDishes

		// Get all active categories
		var categories []models.Country
		if err := db.Where("is_active = ?", true).Order("name ASC").Find(&categories).Error; err != nil {
			httpx.InternalError(c, "failed to fetch categories")
			return
		}
		response.Categories = mappers.CountriesToDTO(categories)

		c.JSON(http.StatusOK, response)
	}
}

// GetCategories godoc
// @Summary List discover categories
// @Description Returns all active countries with live count
// @Tags Discover
// @Produce json
// @Success 200 {object} map[string][]CategoryWithCount
// @Failure 500 {object} map[string]string
// @Router /api/discover/categories [get]
func GetCategories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var rows []CategoryWithCountRow

		// Get countries with live count
		err := db.Model(&models.Country{}).
			Select("countries.*, COUNT(lives.id) as live_count").
			Joins("LEFT JOIN lives ON lives.country_id = countries.id AND lives.status = ?", models.LiveStatusLive).
			Where("countries.is_active = ?", true).
			Group("countries.id").
			Order("countries.name ASC").
			Scan(&rows).Error

		if err != nil {
			httpx.InternalError(c, "failed to fetch categories")
			return
		}

		categories := make([]CategoryWithCount, 0, len(rows))
		for _, r := range rows {
			categories = append(categories, CategoryWithCount{
				CountryDTO: mappers.CountryToDTO(r.Country),
				LiveCount:  r.LiveCount,
			})
		}

		c.JSON(http.StatusOK, gin.H{"categories": categories})
	}
}

// GetCategoryLives godoc
// @Summary Get lives by category
// @Description Returns paginated lives for a specific country with filters
// @Tags Discover
// @Produce json
// @Param id path int true "Category ID"
// @Param page query int false "Page number"
// @Param limit query int false "Page size"
// @Param sort query string false "Sort by (views, viewers, recent)"
// @Param filters[status] query string false "Live status"
// @Param filters[dish_id] query int false "Dish ID"
// @Param filters[min_viewers] query int false "Minimum viewers"
// @Param filters[hours_ago] query int false "Lives started in last N hours"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/discover/categories/{id}/lives [get]
func GetCategoryLives(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		categoryID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			httpx.BadRequest(c, "invalid category ID")
			return
		}

		var country models.Country
		if err := db.First(&country, categoryID).Error; err != nil {
			httpx.NotFound(c, "category not found")
			return
		}

		// Parse query parameters
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit

		// Build query with filters
		query := db.Model(&models.Live{}).
			Preload("User").
			Preload("Dish").
			Where("country_id = ?", categoryID)
		query = applyFilters(query, c)
		query = applySorting(query, c.Query("sort"))

		var total int64
		query.Count(&total)

		// Get lives with pagination
		var lives []models.Live
		if err := query.Offset(offset).Limit(limit).Find(&lives).Error; err != nil {
			httpx.InternalError(c, "failed to fetch lives")
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"lives": lives,
			"pagination": gin.H{
				"page":  page,
				"limit": limit,
				"total": total,
			},
			"category": mappers.CountryToDTO(country),
		})
	}
}
