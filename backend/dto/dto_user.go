package dto

type UserDTO struct {
	ID              string   `json:"id"`
	FirstName       string   `json:"firstName"`
	LastName        string   `json:"lastName"`
	Username        string   `json:"username"`
	ProfileImageURL string   `json:"profileImageUrl"`
	Description     string   `json:"description"`
	FollowerCount   int      `json:"followerCount"`
	IsVerified      bool     `json:"isVerified"`
	IsFeaturedChef  bool     `json:"isFeaturedChef"`
	FollowingIDs    []string `json:"followingIds"`
	FollowersIDs    []string `json:"followersIds"`
}
