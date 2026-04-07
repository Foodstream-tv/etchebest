package auth

import (
	"encoding/json"
	"fmt"
	"net/http"

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

type FacebookTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type FacebookUserInfo struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Picture   struct {
		Data struct {
			Height int    `json:"height"`
			Width  int    `json:"width"`
			URL    string `json:"url"`
		} `json:"data"`
	} `json:"picture"`
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
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code not provided"})
			return
		}

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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to exchange code for token"})
			return
		}
		defer resp.Body.Close()

		var tokenResp GoogleTokenResponse
		if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode token response"})
			return
		}

		// Get user info
		userInfo, err := getGoogleUserInfo(tokenResp.AccessToken)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info from Google"})
			return
		}

		// Check if user exists by Google ID
		var existingUser user.User
		result := db.Where("google_id = ?", userInfo.ID).First(&existingUser)

		if result.Error == gorm.ErrRecordNotFound {
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
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
				return
			}
			existingUser = newUser
		} else if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}

		// Generate JWT token
		token, err := GenerateJWT(&existingUser, jwtKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": token, "userId": existingUser.ID})
	}
}

// FacebookCallback handles Facebook OAuth callback
// @Summary      Facebook OAuth Callback
// @Description  Handle Facebook OAuth callback and authenticate user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        code query string true "Authorization code from Facebook"
// @Success      200  {object}  map[string]string "token: JWT token string"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/auth/facebook/callback [post]
func FacebookCallback(db *gorm.DB, jwtKey []byte, facebookAppID string, facebookAppSecret string, redirectURI string) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Query("code")
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code not provided"})
			return
		}

		// Exchange code for token
		tokenURL := fmt.Sprintf(
			"https://graph.facebook.com/v18.0/oauth/access_token?client_id=%s&client_secret=%s&redirect_uri=%s&code=%s",
			facebookAppID,
			facebookAppSecret,
			redirectURI,
			code,
		)

		resp, err := http.Get(tokenURL)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to exchange code for token"})
			return
		}
		defer resp.Body.Close()

		var tokenResp FacebookTokenResponse
		if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode token response"})
			return
		}

		// Get user info
		userInfo, err := getFacebookUserInfo(tokenResp.AccessToken)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info from Facebook"})
			return
		}

		// Check if user exists by Facebook ID
		var existingUser user.User
		result := db.Where("facebook_id = ?", userInfo.ID).First(&existingUser)

		if result.Error == gorm.ErrRecordNotFound {
			// Create new user
			pictureURL := ""
			if userInfo.Picture.Data.URL != "" {
				pictureURL = userInfo.Picture.Data.URL
			}

			newUser := user.User{
				ID:              uuid.New().String(),
				Email:           userInfo.Email,
				FirstName:       userInfo.FirstName,
				LastName:        userInfo.LastName,
				Username:        generateUsername(userInfo.FirstName, userInfo.LastName),
				ProfileImageURL: pictureURL,
				FacebookID:      &userInfo.ID,
				OAuthProvider:   strPtr("facebook"),
				Password:        uuid.New().String(), // Random password for OAuth users
			}

			if err := db.Create(&newUser).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
				return
			}
			existingUser = newUser
		} else if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}

		// Generate JWT token
		token, err := GenerateJWT(&existingUser, jwtKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": token, "userId": existingUser.ID})
	}
}

// Helper functions
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

func getFacebookUserInfo(accessToken string) (*FacebookUserInfo, error) {
	url := fmt.Sprintf(
		"https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.width(200).height(200)&access_token=%s",
		accessToken,
	)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var userInfo FacebookUserInfo
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
