package auth

import (
	"testing"
	"time"

	userModule "github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateAndParseJWT(t *testing.T) {
	jwtKey := []byte("test-secret-key-12345")
	testUser := &userModule.User{
		ID:    "user-uuid-123",
		Email: "chef@foodstream.tv",
		Role:  userModule.USER,
	}

	tokenStr, err := GenerateJWT(testUser, jwtKey)
	if err != nil {
		t.Fatalf("failed to generate JWT: %v", err)
	}

	if tokenStr == "" {
		t.Fatal("expected non-empty token string")
	}

	claims := &Claims{}
	parsedToken, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil {
		t.Fatalf("failed to parse token: %v", err)
	}

	if !parsedToken.Valid {
		t.Fatal("expected token to be valid")
	}

	if claims.UserID != testUser.ID {
		t.Fatalf("expected UserID %s, got %s", testUser.ID, claims.UserID)
	}

	if claims.Role != testUser.Role {
		t.Fatalf("expected Role %s, got %s", testUser.Role, claims.Role)
	}
}

func TestBannedUserCheck(t *testing.T) {
	// Not banned
	normalUser := userModule.User{
		ID:       "u1",
		IsBanned: false,
	}
	if normalUser.IsCurrentlyBanned() {
		t.Fatal("expected normal user not to be banned")
	}

	// Permanently banned
	permBanned := userModule.User{
		ID:       "u2",
		IsBanned: true,
	}
	if !permBanned.IsCurrentlyBanned() {
		t.Fatal("expected permanently banned user to be banned")
	}

	// Temporarily banned in the future
	futureTime := time.Now().Add(2 * time.Hour)
	tempBanned := userModule.User{
		ID:          "u3",
		IsBanned:    true,
		BannedUntil: &futureTime,
	}
	if !tempBanned.IsCurrentlyBanned() {
		t.Fatal("expected user with future BannedUntil to be banned")
	}

	// Ban expired
	pastTime := time.Now().Add(-2 * time.Hour)
	expiredBan := userModule.User{
		ID:          "u4",
		IsBanned:    true,
		BannedUntil: &pastTime,
	}
	if expiredBan.IsCurrentlyBanned() {
		t.Fatal("expected user with past BannedUntil not to be banned")
	}
}
