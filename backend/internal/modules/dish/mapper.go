package dish

import (
	"github.com/Foodstream-io/etchebest/internal/modules/country"
)

func DishToDTO(d Dish) DishDTO {
	var tmpCountry *country.CountryDTO

	if d.Country != nil {
		c := country.CountryToDTO(*d.Country)
		tmpCountry = &c
	}

	return DishDTO{
		ID:          d.ID,
		Name:        d.Name,
		ImageURL:    d.ImageURL,
		Description: d.Description,
		Country:     tmpCountry,
	}
}
