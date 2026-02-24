package live

import (
	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
)

func LiveToDTO(live Live) LiveDTO {
	dtoLive := LiveDTO{
		ID:             live.ID,
		Title:          live.Title,
		Description:    live.Description,
		Status:         live.Status,
		ViewCount:      live.ViewCount,
		CurrentViewers: live.CurrentViewers,
		LikeCount:      live.LikeCount,
		ThumbnailURL:   live.ThumbnailURL,
		PreviewGIF:     live.PreviewGIF,
		StartedAt:      live.StartedAt,
		EndedAt:        live.EndedAt,
		HasReplay:      live.HasReplay,
		ReplayURL:      live.ReplayURL,
		ReplayViews:    live.ReplayViews,
		CreatedAt:      live.CreatedAt,
	}

	// User
	if live.User.ID != "" {
		u := user.UserToDTO(live.User)
		dtoLive.User = &u
	}

	// Dish
	if live.Dish.ID != 0 {
		d := dish.DishToDTO(live.Dish)
		dtoLive.Dish = &d
	}

	// Country
	if live.Country.ID != 0 {
		c := country.CountryToDTO(live.Country)
		dtoLive.Country = &c
	}

	// Tags
	if len(live.Tags) > 0 {
		dtoLive.Tags = tag.TagsToDTO(live.Tags)
	}

	return dtoLive
}
