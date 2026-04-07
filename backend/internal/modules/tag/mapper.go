package tag

func TagToDTO(tag Tag) TagDTO {
	return TagDTO{
		ID:        tag.ID,
		Name:      tag.Name,
		Slug:      tag.Slug,
		ImageURL:  tag.ImageURL,
		Color:     tag.Color,
		LiveCount: tag.LiveCount,
	}
}

func TagsToDTO(tags []Tag) []TagDTO {
	result := make([]TagDTO, 0, len(tags))
	for _, tag := range tags {
		result = append(result, TagToDTO(tag))
	}
	return result
}
