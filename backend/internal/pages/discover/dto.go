package discover

import "github.com/Foodstream-io/etchebest/internal/dto"

type DiscoverHomeResponse struct {
	TrendingCountry *dto.CountryDTO  `json:"trending_country"`
	TopDishes       []DishWithStats  `json:"top_dishes"`
	Categories      []dto.CountryDTO `json:"categories"`
}
