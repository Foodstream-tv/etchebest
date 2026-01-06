package mappers

import (
	"github.com/Foodstream-io/etchebest/dto"
	"github.com/Foodstream-io/etchebest/models"
)

func TagToDTO(tag models.Tag) dto.TagDTO {
	return dto.TagDTO{
		ID:        tag.ID,
		Name:      tag.Name,
		Slug:      tag.Slug,
		ImageURL:  tag.ImageURL,
		Color:     tag.Color,
		LiveCount: tag.LiveCount,
	}
}

func TagsToDTO(tags []models.Tag) []dto.TagDTO {
	result := make([]dto.TagDTO, 0, len(tags))
	for _, tag := range tags {
		result = append(result, TagToDTO(tag))
	}
	return result
}
