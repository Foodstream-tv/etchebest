package mappers

import (
	"github.com/Foodstream-io/etchebest/dto"
	"github.com/Foodstream-io/etchebest/models"
)

func LiveToDTO(live models.Live) dto.LiveDTO {
	dtoLive := dto.LiveDTO{
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
		u := UserToDTO(live.User)
		dtoLive.User = &u
	}

	// Dish
	if live.Dish.ID != 0 {
		d := DishToDTO(live.Dish)
		dtoLive.Dish = &d
	}

	// Country
	if live.Country.ID != 0 {
		c := CountryToDTO(live.Country)
		dtoLive.Country = &c
	}

	// Tags
	if len(live.Tags) > 0 {
		dtoLive.Tags = TagsToDTO(live.Tags)
	}

	return dtoLive
}
