package home

type LiveDTO struct {
	ID             uint     `json:"id"`
	Title          string   `json:"title"`
	DishName       string   `json:"dishName"`
	Country        string   `json:"country"`
	ViewCount      int      `json:"viewCount"`
	CurrentViewers int      `json:"currentViewers"`
	Status         string   `json:"status"`
	User           UserDTO  `json:"user"`
	Tags           []TagDTO `json:"tags"`
}
