package dto

type DishDTO struct {
	ID          uint        `json:"id"`
	Name        string      `json:"name"`
	ImageURL    string      `json:"image_url"`
	Description string      `json:"description"`
	Country     *CountryDTO `json:"country,omitempty"`
}
