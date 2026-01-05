package home

type HomePageResponse struct {
	FeaturedLive  *LiveDTO        `json:"featured_live"`
	UpcomingLives []LiveDTO       `json:"upcoming_lives"`
	FeaturedChefs []ChefHighlight `json:"featured_chefs"`
	Tags          []TagDTO        `json:"tags"`
}

type LivesTabResponse struct {
	Lives      []LiveDTO  `json:"lives"`
	Pagination Pagination `json:"pagination"`
}

type LivesFilteredResponse struct {
	Lives      []LiveDTO         `json:"lives"`
	Pagination Pagination        `json:"pagination"`
	Filters    map[string]string `json:"filters_applied"`
}

type SearchResponse struct {
	Query      string     `json:"query"`
	Lives      []LiveDTO  `json:"lives"`
	Pagination Pagination `json:"pagination"`
}

type TagsResponse struct {
	Tags []TagDTO `json:"tags"`
}

type ChefsResponse struct {
	Chefs []ChefHighlight `json:"chefs"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
