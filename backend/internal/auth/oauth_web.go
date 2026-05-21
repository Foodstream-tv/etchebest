package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OAuth structs
type GoogleTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	IDToken     string `json:"id_token"`
}

type GoogleUserInfo struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"given_name"`
	LastName  string `json:"family_name"`
	Picture   string `json:"picture"`
}

// GoogleStartAuth initiates Google OAuth flow
// @Summary      Start Google OAuth Flow
// @Description  Generates Google OAuth URL and redirects user to Google consent screen
// @Tags         auth
// @Produce      json
// @Param        redirect query string false "Redirect URL after callback (will be stored in state)"
// @Success      302  "Redirects to Google OAuth consent screen"
// @Failure      400  {object}  map[string]string "error: Missing configuration"
// @Router       /api/auth/google [get]
func GoogleStartAuth(googleClientID string, redirectURI string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if googleClientID == "" || redirectURI == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Google OAuth configuration missing"})
			return
		}

		// Generate state for CSRF protection
		state := uuid.New().String()

		// Get the callback redirect URL from query params (for client redirect after auth)
		callbackRedirect := c.Query("redirect")

		// Build Google OAuth URL
		googleAuthURL := fmt.Sprintf(
			"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=openid+profile+email&state=%s",
			url.QueryEscape(googleClientID),
			url.QueryEscape(redirectURI),
			url.QueryEscape(state),
		)

		// If client provided a callback redirect, store it in state cookie for later use
		if callbackRedirect != "" {
			c.SetCookie("oauth_redirect", callbackRedirect, 600, "/", "", true, true)
		}

		// Store state in cookie for validation in callback
		c.SetCookie("oauth_state", state, 600, "/", "", true, true)

		// Redirect to Google
		c.Redirect(http.StatusTemporaryRedirect, googleAuthURL)
	}
}

// GoogleCallback handles Google OAuth callback
// @Summary      Google OAuth Callback
// @Description  Handle Google OAuth callback and authenticate user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        code query string true "Authorization code from Google"
// @Param        state query string false "State parameter for security"
// @Success      200  {object}  map[string]string "token: JWT token string"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/auth/google/callback [post]
func GoogleCallback(db *gorm.DB, jwtKey []byte, googleClientID string, googleClientSecret string, redirectURI string) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		state := c.Query("state")

		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code not provided"})
			return
		}

		// Validate state (CSRF protection)
		storedState, err := c.Cookie("oauth_state")
		if err != nil || storedState != state {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid state parameter"})
			return
		}

		// Get callback redirect URL from cookie
		callbackRedirect, _ := c.Cookie("oauth_redirect")

		// Exchange code for token
		tokenURL := "https://oauth2.googleapis.com/token"
		data := map[string]string{
			"code":          code,
			"client_id":     googleClientID,
			"client_secret": googleClientSecret,
			"redirect_uri":  redirectURI,
			"grant_type":    "authorization_code",
		}

		// Make request to get token
		resp, err := http.PostForm(tokenURL, convertMapToURLValues(data))
		if err != nil {
			if callbackRedirect != "" {
				c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=failed_to_exchange_token")
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to exchange code for token"})
			}
			return
		}
		defer resp.Body.Close()

		var tokenResp GoogleTokenResponse
		if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
			if callbackRedirect != "" {
				c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=invalid_token_response")
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode token response"})
			}
			return
		}

		// Get user info
		userInfo, err := getGoogleUserInfo(tokenResp.AccessToken)
		if err != nil {
			if callbackRedirect != "" {
				c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=failed_to_get_user_info")
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info from Google"})
			}
			return
		}

		// Check if user exists by Google ID
		var existingUser user.User
		result := db.Where("google_id = ?", userInfo.ID).First(&existingUser)

		if result.Error == gorm.ErrRecordNotFound {
			// Check if user exists by email
			emailResult := db.Where("email = ?", userInfo.Email).First(&existingUser)
			if emailResult.Error == nil {
				// Link Google account to existing user
				existingUser.GoogleID = &userInfo.ID
				existingUser.OAuthProvider = strPtr("google")
				if existingUser.ProfileImageURL == "" {
					existingUser.ProfileImageURL = userInfo.Picture
				}
				if err := db.Save(&existingUser).Error; err != nil {
					if callbackRedirect != "" {
						c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=failed_to_link_account")
					} else {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link account"})
					}
					return
				}
			} else {
				// Create new user
				newUser := user.User{
					ID:              uuid.New().String(),
					Email:           userInfo.Email,
					FirstName:       userInfo.FirstName,
					LastName:        userInfo.LastName,
					Username:        generateUsername(userInfo.FirstName, userInfo.LastName),
					ProfileImageURL: userInfo.Picture,
					GoogleID:        &userInfo.ID,
					OAuthProvider:   strPtr("google"),
					Password:        uuid.New().String(), // Random password for OAuth users
				}

				if err := db.Create(&newUser).Error; err != nil {
					if callbackRedirect != "" {
						c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=failed_to_create_user")
					} else {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
					}
					return
				}
				existingUser = newUser
			}
		} else if result.Error != nil {
			if callbackRedirect != "" {
				c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=database_error")
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			}
			return
		}

		// Generate JWT token
		token, err := GenerateJWT(&existingUser, jwtKey)
		if err != nil {
			if callbackRedirect != "" {
				c.Redirect(http.StatusTemporaryRedirect, getCallbackPath(callbackRedirect)+"?error=failed_to_generate_token")
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			}
			return
		}

		// Clear OAuth cookies
		c.SetCookie("oauth_state", "", -1, "/", "", true, true)
		c.SetCookie("oauth_redirect", "", -1, "/", "", true, true)

		// If there's a callback redirect, redirect with token
		if callbackRedirect != "" {
			redirectURL := fmt.Sprintf("%s?token=%s&userId=%s", getCallbackPath(callbackRedirect), token, existingUser.ID)
			c.Redirect(http.StatusTemporaryRedirect, redirectURL)
		} else {
			// Otherwise return JSON (for API/mobile usage)
			c.JSON(http.StatusOK, gin.H{"token": token, "userId": existingUser.ID})
		}
	}
}

// Helper functions

// getCallbackPath extracts the path from a full URL (e.g., "https://example.com/auth/callback" -> "/auth/callback")
func getCallbackPath(callbackURL string) string {
	if callbackURL == "" {
		return ""
	}

	u, err := url.Parse(callbackURL)
	if err != nil {
		// If parsing fails, return as-is (might already be a relative path)
		return callbackURL
	}

	// Return just the path
	return u.Path
}

func getGoogleUserInfo(accessToken string) (*GoogleUserInfo, error) {
	url := fmt.Sprintf("https://www.googleapis.com/oauth2/v2/userinfo?access_token=%s", accessToken)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

func convertMapToURLValues(data map[string]string) map[string][]string {
	result := make(map[string][]string)
	for key, value := range data {
		result[key] = []string{value}
	}
	return result
}

func generateUsername(firstName string, lastName string) string {
	return fmt.Sprintf("%s%s_%s", firstName, lastName, uuid.New().String()[:8])
}

func strPtr(s string) *string {
	return &s
}
