package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// OAuthMiddleware handles OAuth token validation
// This middleware can be used for endpoints that support both JWT and OAuth tokens
func OAuthMiddleware(jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		// Check if it's a Bearer token (JWT)
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			// Delegate to JWT middleware logic
			c.Set("tokenType", "jwt")
			c.Set("token", tokenStr)
			c.Next()
			return
		}

		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
		c.Abort()
	}
}

// GoogleTokenInfo represents Google's token info response
type GoogleTokenInfo struct {
	Aud    string `json:"aud"`
	UserID string `json:"user_id"`
	Scope  string `json:"scope"`
	Exp    int64  `json:"expires_in"`
	Iat    int64  `json:"iat"`
	Email  string `json:"email"`
}

// ValidateGoogleOAuthToken validates a Google OAuth access token
func ValidateGoogleOAuthToken(accessToken string) (*GoogleTokenInfo, error) {
	url := fmt.Sprintf("https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=%s", accessToken)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid token: status %d", resp.StatusCode)
	}

	var tokenInfo GoogleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, err
	}

	return &tokenInfo, nil
}

// FacebookTokenInfo represents Facebook's debug token response
type FacebookTokenInfo struct {
	Data struct {
		AppID     string   `json:"app_id"`
		UserID    string   `json:"user_id"`
		IsValid   bool     `json:"is_valid"`
		Scopes    []string `json:"scopes"`
		Iat       int64    `json:"iat"`
		Exp       int64    `json:"exp"`
		ExpiresAt int64    `json:"expires_at"`
	} `json:"data"`
}

// ValidateFacebookOAuthToken validates a Facebook OAuth access token
func ValidateFacebookOAuthToken(accessToken string, appID string, appSecret string) (*FacebookTokenInfo, error) {
	url := fmt.Sprintf(
		"https://graph.facebook.com/debug_token?input_token=%s&access_token=%s|%s",
		accessToken,
		appID,
		appSecret,
	)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid token: status %d", resp.StatusCode)
	}

	var tokenInfo FacebookTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, err
	}

	if !tokenInfo.Data.IsValid {
		return nil, fmt.Errorf("token is invalid")
	}

	return &tokenInfo, nil
}
