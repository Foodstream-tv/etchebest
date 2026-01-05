package home

import (
	"net/http"
	"strconv"

	"github.com/Foodstream-io/etchebest/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetHomePage return all home page data
// @Summary Complete home page
// @Description Return the featured live, tabs, chefs, and tags
// @Tags home
// @Produce json
// @Success 200 {object} HomePageResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/home [get]
func GetHomePage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		response := HomePageResponse{}

		featuredLive, err := getFeaturedLive(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch featured live"})
			return
		}
		response.FeaturedLive = featuredLive

		upcomingLives, err := getUpcomingLives(db, 3)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch upcoming lives"})
			return
		}
		response.UpcomingLives = upcomingLives

		featuredChefs, err := getFeaturedChefs(db, 6)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch featured chefs"})
			return
		}
		response.FeaturedChefs = featuredChefs

		tags, err := getTags(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tags"})
			return
		}
		response.Tags = tags

		c.JSON(http.StatusOK, response)
	}
}

// GetLivesByTab return filtered lives by tab with pagination
// @Summary GetLivesByTab
// @Description Return the lives according to the tab: live, popular, replay, scheduled
// @Tags home
// @Produce json
// @Param tab query string true "Tab name" Enums(live, popular, replay, scheduled)
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} LivesTabResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/home/lives [get]
func GetLivesByTab(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		tab := c.DefaultQuery("tab", "live")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

		lives, total, err := getLivesByTab(db, tab, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch lives"})
			return
		}

		response := LivesTabResponse{
			Lives: lives,
			Pagination: Pagination{
				Page:       page,
				Limit:      limit,
				Total:      total,
				TotalPages: (int(total) + limit - 1) / limit,
			},
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetLivesWithFilters return the lives with advanced filters
// @Summary GetLivesWithFilters
// @Description Allow to filter lives by tag, status, user, etc.
// @Tags home
// @Produce json
// @Param filters[tag_id] query string false "Filter by tag ID"
// @Param filters[tag_slug] query string false "Filter by tag slug"
// @Param filters[status] query string false "Filter by status" Enums(live, scheduled, ended)
// @Param filters[user_id] query string false "Filter by user ID"
// @Param filters[min_viewers] query int false "Minimum current viewers"
// @Param filters[has_replay] query boolean false "Has replay available"
// @Param sort query string false "Sort order" Enums(views, viewers, recent)
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} LivesFilteredResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/home/lives/filtered [get]
func GetLivesWithFilters(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		sortBy := c.DefaultQuery("sort", "viewers")

		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 50 {
			limit = 20
		}
		offset := (page - 1) * limit

		// Get filters from query params
		filters := make(map[string]string)
		for key, values := range c.Request.URL.Query() {
			if len(values) > 0 && len(key) > 8 && key[:8] == "filters[" && key[len(key)-1] == ']' {
				filterKey := key[8 : len(key)-1]
				filters[filterKey] = values[0]
			}
		}

		query := db.Model(&models.Live{}).
			Preload("User").
			Preload("Tags")
		query = applyLiveFilters(query, filters)

		switch sortBy {
		case "views":
			query = query.Order("view_count DESC")
		case "viewers":
			query = query.Order("current_viewers DESC")
		case "recent":
			query = query.Order("created_at DESC")
		default:
			query = query.Order("current_viewers DESC, view_count DESC")
		}

		var total int64
		if err := query.Count(&total).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count lives"})
			return
		}

		var lives []LiveDTO
		if err := query.Offset(offset).Limit(limit).Find(&lives).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch lives"})
			return
		}

		response := LivesFilteredResponse{
			Lives: lives,
			Pagination: Pagination{
				Page:       page,
				Limit:      limit,
				Total:      total,
				TotalPages: (int(total) + limit - 1) / limit,
			},
			Filters: filters,
		}

		c.JSON(http.StatusOK, response)
	}
}

// SearchLives do a global search
// @Summary Global search for lives
// @Description Research by title, dish name, chef name
// @Tags home
// @Produce json
// @Param q query string true "Search query"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} SearchResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/home/search [get]
func SearchLives(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
			return
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

		lives, total, err := searchLives(db, query, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
			return
		}

		response := SearchResponse{
			Query: query,
			Lives: lives,
			Pagination: Pagination{
				Page:       page,
				Limit:      limit,
				Total:      total,
				TotalPages: (int(total) + limit - 1) / limit,
			},
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetTags return all available tags
// @Summary List all tags
// @Description Return all active culinary tags with the number of lives
// @Tags home
// @Produce json
// @Success 200 {object} TagsResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/home/tags [get]
func GetTags(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {

		tags, err := getTags(db)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tags"})
			return
		}

		c.JSON(http.StatusOK, TagsResponse{Tags: tags})
	}
}

// GetFeaturedChefs return the featured creators
// @Summary List of featured chefs
// @Description Return popular or featured creators
// @Tags home
// @Produce json
// @Param limit query int false "Number of chefs to return" default(6)
// @Success 200 {object} ChefsResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/home/chefs [get]
func GetFeaturedChefs(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		type ChefsResponse struct {
			Chefs []ChefHighlight `json:"chefs"`
		}

		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "6"))

		chefs, err := getFeaturedChefs(db, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch chefs"})
			return
		}

		c.JSON(http.StatusOK, ChefsResponse{Chefs: chefs})
	}
}

// Pagination represents pagination metadata
type Pagination struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}
