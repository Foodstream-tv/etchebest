package search

import (
	"strings"

	"github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SearchResponse struct {
	Users []user.User `json:"users"`
	Lives []live.Live `json:"lives"`
}

func GlobalSearch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := strings.TrimSpace(c.Query("q"))

		if query == "" {
			c.JSON(200, SearchResponse{
				Users: []user.User{},
				Lives: []live.Live{},
			})
			return
		}

		var users []user.User
		var lives []live.Live

		db.
			Where("LOWER(username) LIKE LOWER(?)", "%"+query+"%").
			Limit(5).
			Find(&users)

		db.
			Where(
				"LOWER(title) LIKE LOWER(?) OR LOWER(dish_name) LIKE LOWER(?)",
				"%"+query+"%",
				"%"+query+"%",
			).
			Limit(5).
			Find(&lives)

		c.JSON(200, SearchResponse{
			Users: users,
			Lives: lives,
		})
	}
}