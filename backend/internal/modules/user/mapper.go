package user

func stringArrayToSlice(arr []string) []string {
	if arr == nil {
		return []string{}
	}
	return arr
}

func UserToDTO(user User) UserDTO {
	return UserDTO{
		ID:              user.ID,
		FirstName:       user.FirstName,
		LastName:        user.LastName,
		Username:        user.Username,
		ProfileImageURL: user.ProfileImageURL,
		Description:     user.Description,
		FollowerCount:   user.FollowerCount,
		IsVerified:      user.IsVerified,
		IsFeaturedChef:  user.IsFeaturedChef,
		FollowingIDs:    stringArrayToSlice(user.FollowingIDS),
		FollowersIDs:    stringArrayToSlice(user.FollowersIDS),
	}
}
