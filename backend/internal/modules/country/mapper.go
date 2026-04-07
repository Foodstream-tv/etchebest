package country

func CountryToDTO(c Country) CountryDTO {
	return CountryDTO{
		ID:       c.ID,
		Name:     c.Name,
		Code:     c.Code,
		ImageURL: c.ImageURL,
	}
}

func CountriesToDTO(countries []Country) []CountryDTO {
	out := make([]CountryDTO, 0, len(countries))
	for _, c := range countries {
		out = append(out, CountryToDTO(c))
	}
	return out
}
