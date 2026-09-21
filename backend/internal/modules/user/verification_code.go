package user

import (
	"time"
)

const (
	VerificationTypeEmail = "email"
	VerificationTypeSMS   = "sms"
)

type VerificationCode struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"not null;index:idx_verification_user"`
	Code      string    `json:"code" gorm:"not null;index:idx_verification_code"`
	Type      string    `json:"type" gorm:"not null"` // "email" or "sms"
	Target    string    `json:"target" gorm:"not null"` // destination email or phone number
	ExpiresAt time.Time `json:"expiresAt" gorm:"not null;index:idx_verification_expires"`
	Used      bool      `json:"used" gorm:"default:false"`
	Attempts  int       `json:"attempts" gorm:"default:0"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// IsValid checks if the code is not used and not expired
func (vc *VerificationCode) IsValid() bool {
	return !vc.Used && time.Now().Before(vc.ExpiresAt) && vc.Attempts < 5
}
