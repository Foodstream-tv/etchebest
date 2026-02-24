package live

import (
	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"time"
)

type LiveDTO struct {
	ID          uint   `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Status      string `json:"status"`

	ViewCount      int `json:"view_count"`
	CurrentViewers int `json:"current_viewers"`
	LikeCount      int `json:"like_count"`

	User    *user.UserDTO       `json:"user,omitempty"`
	Dish    *dish.DishDTO       `json:"dish,omitempty"`
	Country *country.CountryDTO `json:"country,omitempty"`
	Tags    []tag.TagDTO        `json:"tags,omitempty"`

	ThumbnailURL string `json:"thumbnail_url"`
	PreviewGIF   string `json:"preview_gif,omitempty"`

	StartedAt *time.Time `json:"started_at,omitempty"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`

	HasReplay   bool   `json:"has_replay"`
	ReplayURL   string `json:"replay_url,omitempty"`
	ReplayViews int    `json:"replay_views"`

	CreatedAt time.Time `json:"created_at"`
}
