package dto

type CountryDTO struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	Code     string `json:"code"`
	ImageURL string `json:"image_url"`
}
