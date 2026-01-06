package mappers

import (
	"github.com/Foodstream-io/etchebest/dto"
	"github.com/Foodstream-io/etchebest/models"
)

func DishToDTO(d models.Dish) dto.DishDTO {
	var country *dto.CountryDTO
	if d.Country != nil {
		c := CountryToDTO(*d.Country)
		country = &c
	}

	return dto.DishDTO{
		ID:          d.ID,
		Name:        d.Name,
		ImageURL:    d.ImageURL,
		Description: d.Description,
		Country:     country,
	}
}
