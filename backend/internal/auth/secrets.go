package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"os"
)

// Purposes keep a hashed OTP from ever being valid as a hashed reset token.
const (
	purposeVerificationCode = "verification-code"
	purposeResetToken       = "password-reset-token"
)

// hashSecret returns the value stored in the database for a one-time secret
// (verification code, reset token): an HMAC-SHA256 keyed with JWT_SECRET.
// A plain hash would be useless for a 6-digit code (a million candidates), so
// the key is what keeps a leaked table from revealing live codes.
func hashSecret(purpose, value string) string {
	mac := hmac.New(sha256.New, []byte(os.Getenv("JWT_SECRET")))
	mac.Write([]byte(purpose))
	mac.Write([]byte{0})
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

// secretMatches compares a submitted secret with its stored hash in constant time.
func secretMatches(purpose, submitted, storedHash string) bool {
	return subtle.ConstantTimeCompare([]byte(hashSecret(purpose, submitted)), []byte(storedHash)) == 1
}
