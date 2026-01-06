package home

import "github.com/Foodstream-io/etchebest/dto"

type HomePageResponse struct {
	FeaturedLive  *dto.LiveDTO    `json:"featured_live"`
	UpcomingLives []dto.LiveDTO   `json:"upcoming_lives"`
	FeaturedChefs []ChefHighlight `json:"featured_chefs"`
	Tags          []dto.TagDTO    `json:"tags"`
}

type LivesTabResponse struct {
	Lives      []dto.LiveDTO `json:"lives"`
	Pagination Pagination    `json:"pagination"`
}

type LivesFilteredResponse struct {
	Lives      []dto.LiveDTO     `json:"lives"`
	Pagination Pagination        `json:"pagination"`
	Filters    map[string]string `json:"filters_applied"`
}

type SearchResponse struct {
	Query      string        `json:"query"`
	Lives      []dto.LiveDTO `json:"lives"`
	Pagination Pagination    `json:"pagination"`
}

type TagsResponse struct {
	Tags []dto.TagDTO `json:"tags"`
}

type ChefsResponse struct {
	Chefs []ChefHighlight `json:"chefs"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
