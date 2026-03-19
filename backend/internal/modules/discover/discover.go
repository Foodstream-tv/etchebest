package discover

import (
	"net/http"
	"sort"
	"strconv"

	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CategoryWithCount is CountryDTO enriched with a live count.
type CategoryWithCount struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	ImageURL  string `json:"image_url"`
	LiveCount int64  `json:"live_count"`
}

// DishWithStats is DishDTO enriched with live count and total views.
type DishWithStats struct {
	ID          uint                `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	ImageURL    string              `json:"image_url"`
	Country     *country.CountryDTO `json:"country,omitempty"`
	LiveCount   int64               `json:"live_count"`
	TotalViews  int64               `json:"total_views"`
}

// DiscoverResponse is the payload for GET /api/discover.
type DiscoverResponse struct {
	TrendingCountry *CategoryWithCount  `json:"trending_country"`
	Categories      []CategoryWithCount `json:"categories"`
	TopDishes       []DishWithStats     `json:"top_dishes"`
}

// CategoryLivesResponse is the payload for GET /api/discover/categories/:id/lives.
type CategoryLivesResponse struct {
	Lives      []live.LiveDTO     `json:"lives"`
	Category   CategoryWithCount  `json:"category"`
	Pagination PaginationMeta     `json:"pagination"`
}

type PaginationMeta struct {
	Page  int   `json:"page"`
	Limit int   `json:"limit"`
	Total int64 `json:"total"`
}

// liveCountByCountry returns a map[countryID]liveCount for active lives.
func liveCountByCountry(db *gorm.DB) map[uint]int64 {
	type row struct {
		CountryID uint
		Count     int64
	}
	var rows []row
	db.Model(&live.Live{}).
		Select("country_id, count(*) as count").
		Where("status IN ?", []string{"scheduled", "live"}).
		Group("country_id").
		Scan(&rows)

	m := make(map[uint]int64, len(rows))
	for _, r := range rows {
		m[r.CountryID] = r.Count
	}
	return m
}

// GetDiscover godoc
// @Summary      Get discover page data
// @Description  Returns trending country, categories list and top dishes
// @Tags         discover
// @Produce      json
// @Success      200  {object}  DiscoverResponse
// @Failure      500  {object}  map[string]string
// @Router       /api/discover [get]
func GetDiscover(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// --- Categories (countries) ---
		var countries []country.Country
		if err := db.Where("is_active = ?", true).Find(&countries).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch categories"})
			return
		}

		liveCounts := liveCountByCountry(db)

		categories := make([]CategoryWithCount, 0, len(countries))
		for _, ct := range countries {
			categories = append(categories, CategoryWithCount{
				ID:        ct.ID,
				Name:      ct.Name,
				Code:      ct.Code,
				ImageURL:  ct.ImageURL,
				LiveCount: liveCounts[ct.ID],
			})
		}

		// --- Trending country: the one with the most active lives ---
		var trendingCountry *CategoryWithCount
		if len(categories) > 0 {
			best := categories[0]
			for _, cat := range categories[1:] {
				if cat.LiveCount > best.LiveCount {
					best = cat
				}
			}
			trendingCountry = &best
		}

		// --- Top dishes: ranked by total_views, with live count ---
		type dishStats struct {
			DishID    uint
			LiveCount int64
		}
		var dishRows []dishStats
		db.Model(&live.Live{}).
			Select("dish_id, count(*) as live_count").
			Where("status IN ?", []string{"scheduled", "live"}).
			Group("dish_id").
			Scan(&dishRows)

		dishLiveCount := make(map[uint]int64, len(dishRows))
		for _, r := range dishRows {
			dishLiveCount[r.DishID] = r.LiveCount
		}

		var dishes []dish.Dish
		if err := db.Preload("Country").Order("is_active desc").Limit(20).Find(&dishes).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch dishes"})
			return
		}

		// Compute total_views per dish from the live table
		type viewRow struct {
			DishID     uint
			TotalViews int64
		}
		var viewRows []viewRow
		db.Model(&live.Live{}).
			Select("dish_id, coalesce(sum(view_count), 0) as total_views").
			Group("dish_id").
			Scan(&viewRows)

		dishTotalViews := make(map[uint]int64, len(viewRows))
		for _, r := range viewRows {
			dishTotalViews[r.DishID] = r.TotalViews
		}

		topDishes := make([]DishWithStats, 0, len(dishes))
		for _, d := range dishes {
			var countryDTO *country.CountryDTO
			if d.Country != nil {
				c := country.CountryToDTO(*d.Country)
				countryDTO = &c
			}
			topDishes = append(topDishes, DishWithStats{
				ID:          d.ID,
				Name:        d.Name,
				Description: d.Description,
				ImageURL:    d.ImageURL,
				Country:     countryDTO,
				LiveCount:   dishLiveCount[d.ID],
				TotalViews:  dishTotalViews[d.ID],
			})
		}

		sort.Slice(topDishes, func(i, j int) bool {
			return topDishes[i].TotalViews > topDishes[j].TotalViews
		})

		c.JSON(http.StatusOK, DiscoverResponse{
			TrendingCountry: trendingCountry,
			Categories:      categories,
			TopDishes:       topDishes,
		})
	}
}

// GetCategories godoc
// @Summary      Get all categories
// @Description  Returns all active country categories with their live counts
// @Tags         discover
// @Produce      json
// @Success      200  {array}   CategoryWithCount
// @Failure      500  {object}  map[string]string
// @Router       /api/discover/categories [get]
func GetCategories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var countries []country.Country
		if err := db.Where("is_active = ?", true).Find(&countries).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch categories"})
			return
		}

		liveCounts := liveCountByCountry(db)

		categories := make([]CategoryWithCount, 0, len(countries))
		for _, ct := range countries {
			categories = append(categories, CategoryWithCount{
				ID:        ct.ID,
				Name:      ct.Name,
				Code:      ct.Code,
				ImageURL:  ct.ImageURL,
				LiveCount: liveCounts[ct.ID],
			})
		}

		c.JSON(http.StatusOK, categories)
	}
}

// GetCategoryLives godoc
// @Summary      Get lives for a category
// @Description  Returns paginated lives for a given country category
// @Tags         discover
// @Produce      json
// @Param        id      path     int     true  "Country ID"
// @Param        page    query    int     false "Page number (default 1)"
// @Param        limit   query    int     false "Items per page (default 20)"
// @Param        sort    query    string  false "Sort: views | viewers | recent"
// @Success      200  {object}  CategoryLivesResponse
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/discover/categories/{id}/lives [get]
func GetCategoryLives(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		countryID, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid category id"})
			return
		}

		// Resolve country
		var ct country.Country
		if err := db.First(&ct, countryID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "category not found"})
			return
		}

		// Pagination
		page := 1
		limit := 20
		if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
			page = p
		}
		if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 100 {
			limit = l
		}
		offset := (page - 1) * limit

		// Sort
		sort := c.Query("sort")
		orderClause := "created_at DESC"
		switch sort {
		case "views":
			orderClause = "view_count DESC"
		case "viewers":
			orderClause = "current_viewers DESC"
		case "recent":
			orderClause = "created_at DESC"
		}

		// Count
		var total int64
		db.Model(&live.Live{}).Where("country_id = ?", countryID).Count(&total)

		// Fetch
		var lives []live.Live
		if err := db.
			Preload("User").
			Preload("Dish").
			Preload("Country").
			Preload("Tags").
			Where("country_id = ?", countryID).
			Order(orderClause).
			Limit(limit).
			Offset(offset).
			Find(&lives).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch lives"})
			return
		}

		liveDTOs := make([]live.LiveDTO, 0, len(lives))
		for _, l := range lives {
			liveDTOs = append(liveDTOs, live.LiveToDTO(l))
		}

		liveCounts := liveCountByCountry(db)
		cat := CategoryWithCount{
			ID:        ct.ID,
			Name:      ct.Name,
			Code:      ct.Code,
			ImageURL:  ct.ImageURL,
			LiveCount: liveCounts[ct.ID],
		}

		c.JSON(http.StatusOK, CategoryLivesResponse{
			Lives:    liveDTOs,
			Category: cat,
			Pagination: PaginationMeta{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		})
	}
}
