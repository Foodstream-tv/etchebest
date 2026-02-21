package mappers

import (
	"github.com/Foodstream-io/etchebest/dto"
	"github.com/Foodstream-io/etchebest/models"
)

func stringArrayToSlice(arr []string) []string {
	if arr == nil {
		return []string{}
	}
	return arr
}

func UserToDTO(user models.User) dto.UserDTO {
	return dto.UserDTO{
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
