package search

import (
	"strings"

	"github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type SearchResponse struct {
	Users []user.UserDTO `json:"users"`
	Lives []live.LiveDTO `json:"lives"`
}

func GlobalSearch(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := strings.TrimSpace(c.Query("q"))

		if query == "" {
			c.JSON(200, SearchResponse{
				Users: []user.UserDTO{},
				Lives: []live.LiveDTO{},
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

		// Public DTOs only: the raw models carry e-mail, phone, ban and OAuth data.
		userDTOs := make([]user.UserDTO, 0, len(users))
		for _, u := range users {
			userDTOs = append(userDTOs, user.UserToDTO(u))
		}
		liveDTOs := make([]live.LiveDTO, 0, len(lives))
		for _, l := range lives {
			liveDTOs = append(liveDTOs, live.LiveToDTO(l))
		}

		c.JSON(200, SearchResponse{
			Users: userDTOs,
			Lives: liveDTOs,
		})
	}
}
