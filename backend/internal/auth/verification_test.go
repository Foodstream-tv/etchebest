package auth

import (
	"testing"
	"time"

	userModule "github.com/Foodstream-io/etchebest/internal/modules/user"
)

func TestGenerateOTP(t *testing.T) {
	for i := 0; i < 10; i++ {
		otp, err := GenerateOTP()
		if err != nil {
			t.Fatalf("GenerateOTP failed: %v", err)
		}
		if len(otp) != 6 {
			t.Fatalf("expected 6 digits, got %s (len %d)", otp, len(otp))
		}
		for _, r := range otp {
			if r < '0' || r > '9' {
				t.Fatalf("expected all digits, got character %c in %s", r, otp)
			}
		}
	}
}

func TestVerificationCodeValidity(t *testing.T) {
	// Valid code
	vc := userModule.VerificationCode{
		Code:      "123456",
		ExpiresAt: time.Now().Add(10 * time.Minute),
		Used:      false,
		Attempts:  0,
	}
	if !vc.IsValid() {
		t.Errorf("expected valid verification code to be valid")
	}

	// Used code
	vcUsed := userModule.VerificationCode{
		Code:      "123456",
		ExpiresAt: time.Now().Add(10 * time.Minute),
		Used:      true,
		Attempts:  0,
	}
	if vcUsed.IsValid() {
		t.Errorf("expected used verification code to be invalid")
	}

	// Expired code
	vcExpired := userModule.VerificationCode{
		Code:      "123456",
		ExpiresAt: time.Now().Add(-1 * time.Minute),
		Used:      false,
		Attempts:  0,
	}
	if vcExpired.IsValid() {
		t.Errorf("expected expired verification code to be invalid")
	}

	// Exceeded attempts
	vcMaxAttempts := userModule.VerificationCode{
		Code:      "123456",
		ExpiresAt: time.Now().Add(10 * time.Minute),
		Used:      false,
		Attempts:  5,
	}
	if vcMaxAttempts.IsValid() {
		t.Errorf("expected code with 5 attempts to be invalid")
	}
}

func TestPasswordResetTokenValidity(t *testing.T) {
	// Valid token
	validToken := userModule.PasswordResetToken{
		Token:     "test-token-123",
		ExpiresAt: time.Now().Add(30 * time.Minute),
		Used:      false,
	}
	if !validToken.IsValid() {
		t.Errorf("expected valid reset token to be valid")
	}

	// Used token
	usedToken := userModule.PasswordResetToken{
		Token:     "test-token-123",
		ExpiresAt: time.Now().Add(30 * time.Minute),
		Used:      true,
	}
	if usedToken.IsValid() {
		t.Errorf("expected used reset token to be invalid")
	}

	// Expired token
	expiredToken := userModule.PasswordResetToken{
		Token:     "test-token-123",
		ExpiresAt: time.Now().Add(-5 * time.Minute),
		Used:      false,
	}
	if expiredToken.IsValid() {
		t.Errorf("expected expired reset token to be invalid")
	}
}

