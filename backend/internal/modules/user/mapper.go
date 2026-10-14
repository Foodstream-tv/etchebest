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

// usersToDTOs converts users to their public representation (no e-mail, phone, ban or OAuth data).
func usersToDTOs(users []User) []UserDTO {
	dtos := make([]UserDTO, 0, len(users))
	for _, u := range users {
		dtos = append(dtos, UserToDTO(u))
	}
	return dtos
}
