package dto

type TagDTO struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	ImageURL  string `json:"image_url"`
	Color     string `json:"color"`
	LiveCount int    `json:"live_count"`
}
