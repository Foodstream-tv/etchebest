package live

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	// maxLiveTags caps the tags of one live (the picker suggests 3, more is allowed but bounded).
	maxLiveTags = 10
	// maxTagNameLength mirrors the size of tags.name.
	maxTagNameLength = 100
)

type updateLiveTagsRequest struct {
	Tags []string `json:"tags"`
}

// tagSlug is the slug used when a live is created (see room.resolveOrCreateTag): keep both in sync.
func tagSlug(name string) string {
	return strings.ReplaceAll(strings.ToLower(name), " ", "-")
}

// normalizeTagNames trims the names, drops empty ones and duplicates (same slug), and refuses lists that
// are too long.
func normalizeTagNames(names []string) ([]string, bool) {
	seen := make(map[string]struct{}, len(names))
	cleaned := make([]string, 0, len(names))
	for _, raw := range names {
		name := strings.TrimSpace(raw)
		if name == "" {
			continue
		}
		if utf8.RuneCountInString(name) > maxTagNameLength {
			return nil, false
		}
		slug := tagSlug(name)
		if _, dup := seen[slug]; dup {
			continue
		}
		seen[slug] = struct{}{}
		cleaned = append(cleaned, name)
	}
	if len(cleaned) > maxLiveTags {
		return nil, false
	}
	return cleaned, true
}

func findOrCreateTag(db *gorm.DB, name string) (tag.Tag, error) {
	slug := tagSlug(name)
	var existing tag.Tag
	if err := db.Where("slug = ?", slug).First(&existing).Error; err == nil {
		return existing, nil
	}
	created := tag.Tag{Name: name, Slug: slug, IsActive: true}
	if err := db.Create(&created).Error; err != nil {
		return tag.Tag{}, err
	}
	return created, nil
}

// UpdateLiveTags replaces the tags of a live that has not ended. Only its host may do it: tags are optional
// at creation and can be completed afterwards while the live is being prepared.
func UpdateLiveTags(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		currentUserID := c.GetString("userId")
		if currentUserID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req updateLiveTagsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		names, ok := normalizeTagNames(req.Tags)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "too many tags or tag name too long"})
			return
		}

		idParam := c.Param("id")
		var target Live
		var err error
		if numericID, parseErr := strconv.Atoi(idParam); parseErr == nil {
			err = db.Where("id = ?", numericID).First(&target).Error
		} else {
			err = db.Where("room_id = ?", idParam).First(&target).Error
		}
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "live not found"})
			return
		}
		if target.UserID != currentUserID {
			c.JSON(http.StatusForbidden, gin.H{"error": "only the host can edit the tags of a live"})
			return
		}
		if target.Status == "ended" {
			c.JSON(http.StatusConflict, gin.H{"error": "this live has ended"})
			return
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			resolved := make([]tag.Tag, 0, len(names))
			for _, name := range names {
				t, err := findOrCreateTag(tx, name)
				if err != nil {
					return err
				}
				resolved = append(resolved, t)
			}
			if err := tx.Model(&target).Association("Tags").Replace(resolved); err != nil {
				return err
			}
			// The first tag doubles as the dish name used by the search (same rule as at creation).
			dishName := ""
			if len(names) > 0 {
				dishName = names[0]
			}
			return tx.Model(&target).Update("dish_name", dishName).Error
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update tags"})
			return
		}

		var updated Live
		if err := db.Preload("User").Preload("Tags").First(&updated, target.ID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reload live"})
			return
		}
		c.JSON(http.StatusOK, LiveToDTO(updated))
	}
}
