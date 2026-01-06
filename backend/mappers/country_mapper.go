package mappers

import (
	"github.com/Foodstream-io/etchebest/dto"
	"github.com/Foodstream-io/etchebest/models"
)

func CountryToDTO(c models.Country) dto.CountryDTO {
	return dto.CountryDTO{
		ID:       c.ID,
		Name:     c.Name,
		Code:     c.Code,
		ImageURL: c.ImageURL,
	}
}

func CountriesToDTO(countries []models.Country) []dto.CountryDTO {
	out := make([]dto.CountryDTO, 0, len(countries))
	for _, c := range countries {
		out = append(out, CountryToDTO(c))
	}
	return out
}
