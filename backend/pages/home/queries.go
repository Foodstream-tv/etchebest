package home

import (
	"fmt"
	"strings"
	"time"

	"github.com/Foodstream-io/etchebest/models"
	"gorm.io/gorm"
)

type ChefHighlight struct {
	UserDTO
	ActiveLivesCount int    `json:"active_lives_count"`
	RecentLiveTitle  string `json:"recent_live_title,omitempty"`
}

// Criteria: status=live, high viewers, featured score
func getFeaturedLive(db *gorm.DB) (*LiveDTO, error) {
	var live LiveDTO

	// Score calculation: (current_viewers * 2) + (view_count / 100) + (like_count * 0.5)
	err := db.Preload("User").
		Preload("Tags").
		Where("status = ?", models.LiveStatusLive).
		Where("current_viewers > ?", 0).
		Order("(CASE WHEN is_featured THEN 1000 ELSE 0 END) + (current_viewers * 2) + (view_count / 100) + (like_count * 0.5) DESC").
		First(&live).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // no live
		}
		return nil, err
	}

	return &live, nil
}

func getLivesByTab(db *gorm.DB, tab string, page, limit int) ([]LiveDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := db.Model(&LiveDTO{}).
		Preload("User").
		Preload("Tags")

	// Filtres selon la tab
	switch tab {
	case "live":
		query = query.Where("status = ?", models.LiveStatusLive).
			Order("current_viewers DESC, created_at DESC")

	case "popular":
		query = query.Where("status IN ?", []string{models.LiveStatusLive, models.LiveStatusEnded}).
			Order("view_count DESC, created_at DESC")

	case "replay":
		query = query.Where("status = ?", models.LiveStatusEnded).
			Where("has_replay = ?", true).
			Order("ended_at DESC")

	case "scheduled":
		query = query.Where("status = ?", models.LiveStatusScheduled).
			Where("started_at > ?", time.Now()).
			Order("started_at ASC")

	default:
		query = query.Where("status IN ?", []string{models.LiveStatusLive, models.LiveStatusScheduled}).
			Order("CASE WHEN status = 'live' THEN 0 ELSE 1 END, current_viewers DESC")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var lives []LiveDTO
	if err := query.Offset(offset).Limit(limit).Find(&lives).Error; err != nil {
		return nil, 0, err
	}

	return lives, total, nil
}

func getUpcomingLives(db *gorm.DB, limit int) ([]LiveDTO, error) {
	if limit < 1 || limit > 10 {
		limit = 3
	}

	var lives []LiveDTO
	err := db.Preload("User").
		Preload("Tags").
		Where("status = ?", models.LiveStatusScheduled).
		Where("started_at > ?", time.Now()).
		Order("started_at ASC").
		Limit(limit).
		Find(&lives).Error

	if err != nil {
		return nil, err
	}

	return lives, nil
}

// Criteria: is_featured_chef=true OR high recent activity
func getFeaturedChefs(db *gorm.DB, limit int) ([]ChefHighlight, error) {
	if limit < 1 || limit > 20 {
		limit = 6
	}

	var chefs []ChefHighlight

	err := db.Model(&models.User{}).
		Select(`
			users.*,
			COUNT(CASE WHEN lives.status = 'live' THEN 1 END) as active_lives_count,
			MAX(lives.title) as recent_live_title
		`).
		Joins("LEFT JOIN lives ON lives.user_id = users.id").
		Where("users.is_featured_chef = ? OR users.last_live_at > ?",
			true,
			time.Now().Add(-7*24*time.Hour),
		).
		Group("users.id").
		Order(`
			(CASE WHEN users.is_featured_chef THEN 1000 ELSE 0 END) + 
			(users.follower_count / 10) + 
			COUNT(CASE WHEN lives.status = 'live' THEN 1 END) * 100 DESC
		`).
		Limit(limit).
		Scan(&chefs).Error

	if err != nil {
		return nil, err
	}

	return chefs, nil
}

func getTags(db *gorm.DB) ([]TagDTO, error) {
	var tags []TagDTO

	err := db.Model(&TagDTO{}).
		Select("tags.*, COUNT(live_tags.live_id) as live_count").
		Joins("LEFT JOIN live_tags ON live_tags.tag_id = tags.id").
		Joins("LEFT JOIN lives ON lives.id = live_tags.live_id AND lives.status IN ('live', 'scheduled')").
		Where("tags.is_active = ?", true).
		Group("tags.id").
		Order("live_count DESC, tags.name ASC").
		Find(&tags).Error

	if err != nil {
		return nil, err
	}

	return tags, nil
}

func searchLives(db *gorm.DB, query string, page, limit int) ([]LiveDTO, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	query = strings.TrimSpace(query)
	if query == "" {
		return []LiveDTO{}, 0, nil
	}

	searchPattern := "%" + strings.ToLower(query) + "%"

	dbQuery := db.Model(&LiveDTO{}).
		Preload("User").
		Preload("Tags").
		Joins("JOIN users ON users.id = lives.user_id").
		Where(`
			LOWER(lives.title) LIKE ? OR 
			LOWER(lives.dish_name) LIKE ? OR 
			LOWER(users.username) LIKE ? OR
			LOWER(users.full_name) LIKE ?
		`, searchPattern, searchPattern, searchPattern, searchPattern).
		Where("lives.status IN ?", []string{models.LiveStatusLive, models.LiveStatusScheduled, models.LiveStatusEnded})

	var total int64
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var lives []LiveDTO
	err := dbQuery.
		Order(`
			CASE 
				WHEN lives.status = 'live' THEN 0
				WHEN lives.status = 'scheduled' THEN 1
				ELSE 2
			END,
			lives.view_count DESC
		`).
		Offset(offset).
		Limit(limit).
		Find(&lives).Error

	if err != nil {
		return nil, 0, err
	}

	return lives, total, nil
}

func applyLiveFilters(query *gorm.DB, filters map[string]string) *gorm.DB {
	if tagID, ok := filters["tag_id"]; ok && tagID != "" {
		query = query.Joins("JOIN live_tags ON live_tags.live_id = lives.id").
			Where("live_tags.tag_id = ?", tagID)
	}
	if tagSlug, ok := filters["tag_slug"]; ok && tagSlug != "" {
		query = query.Joins("JOIN live_tags ON live_tags.live_id = lives.id").
			Joins("JOIN tags ON tags.id = live_tags.tag_id").
			Where("tags.slug = ?", tagSlug)
	}

	if status, ok := filters["status"]; ok && status != "" {
		validStatuses := map[string]bool{models.LiveStatusScheduled: true, models.LiveStatusLive: true, models.LiveStatusEnded: true}
		if validStatuses[status] {
			query = query.Where("lives.status = ?", status)
		}
	}

	if minViewers, ok := filters["min_viewers"]; ok && minViewers != "" {
		query = query.Where("lives.current_viewers >= ?", minViewers)
	}

	if hasReplay, ok := filters["has_replay"]; ok && hasReplay == "true" {
		query = query.Where("lives.has_replay = ?", true)
	}

	if userID, ok := filters["user_id"]; ok && userID != "" {
		query = query.Where("lives.user_id = ?", userID)
	}

	if maxDuration, ok := filters["max_duration"]; ok && maxDuration != "" {
		minutes, err := parseIntSafe(maxDuration)
		if err == nil && minutes > 0 {
			query = query.Where("lives.duration <= ?", minutes*60)
		}
	}

	return query
}

func parseIntSafe(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
