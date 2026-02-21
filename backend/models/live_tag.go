package models

type LiveTag struct {
	LiveID uint `gorm:"primaryKey;index:idx_live_tag"`
	TagID  uint `gorm:"primaryKey;index:idx_tag_live"`
}
