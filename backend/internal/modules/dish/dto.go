package dish

import "github.com/Foodstream-io/etchebest/internal/modules/country"

type DishDTO struct {
	ID          uint                `json:"id"`
	Name        string              `json:"name"`
	ImageURL    string              `json:"image_url"`
	Description string              `json:"description"`
	Country     *country.CountryDTO `json:"country,omitempty"`
}
