package user

import (
	"time"
)

type PasswordResetToken struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index:idx_pwd_reset_user_id;not null"`
	Email     string    `json:"email" gorm:"index:idx_pwd_reset_email;not null"`
	Token     string    `json:"token" gorm:"uniqueIndex:idx_pwd_reset_token;not null"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"not null"`
	Used      bool      `json:"used" gorm:"default:false"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

func (t *PasswordResetToken) IsValid() bool {
	return !t.Used && time.Now().Before(t.ExpiresAt)
}
