package auth

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/internal/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GoogleMobileRequest represents the mobile OAuth request with Google access token
type GoogleMobileRequest struct {
	AccessToken string `json:"access_token" binding:"required" example:"ya29.a0AfH6SMBx..."`
}

// GoogleMobileCallback godoc
// @Summary      Google OAuth Mobile Callback
// @Description  Exchange Google access token for JWT token (for mobile apps)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.GoogleMobileRequest true "Google access token"
// @Success      200  {object}  map[string]string "token: JWT token string, userId: user ID"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Failure      401  {object}  map[string]string "error: Invalid access token"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/auth/google/mobile [post]
func GoogleMobileCallback(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req GoogleMobileRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "access_token is required"})
			return
		}

		// Fetch user info using the access token
		userInfo, err := getGoogleUserInfo(req.AccessToken)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired access token"})
			return
		}

		// Check if user already exists by Google ID
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
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link account"})
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
					Password:        uuid.New().String(),
				}

				if err := db.Create(&newUser).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
					return
				}
				existingUser = newUser
			}
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

		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user": gin.H{
				"id":       existingUser.ID,
				"email":    existingUser.Email,
				"username": existingUser.Username,
			},
		})
	}
}

// FacebookMobileCallback godoc
// @Summary      Facebook OAuth Mobile Callback
// @Description  Exchange Facebook access token for JWT token (for mobile apps)
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.GoogleMobileRequest true "Facebook access token"
// @Success      200  {object}  map[string]string "token: JWT token string, userId: user ID"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Failure      401  {object}  map[string]string "error: Invalid access token"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/auth/facebook/mobile [post]
func FacebookMobileCallback(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req GoogleMobileRequest

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "access_token is required"})
			return
		}

		// Fetch user info using the access token
		userInfo, err := getFacebookUserInfo(req.AccessToken)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired access token"})
			return
		}

		// Check if user already exists by Facebook ID
		var existingUser user.User
		result := db.Where("facebook_id = ?", userInfo.ID).First(&existingUser)

		if result.Error == gorm.ErrRecordNotFound {
			// Check if user exists by email
			emailResult := db.Where("email = ?", userInfo.Email).First(&existingUser)
			if emailResult.Error == nil {
				// Link Facebook account to existing user
				existingUser.FacebookID = &userInfo.ID
				existingUser.OAuthProvider = strPtr("facebook")
				pictureURL := ""
				if userInfo.Picture.Data.URL != "" {
					pictureURL = userInfo.Picture.Data.URL
				}
				if existingUser.ProfileImageURL == "" && pictureURL != "" {
					existingUser.ProfileImageURL = pictureURL
				}
				if err := db.Save(&existingUser).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link account"})
					return
				}
			} else {
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
					Password:        uuid.New().String(),
				}

				if err := db.Create(&newUser).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
					return
				}
				existingUser = newUser
			}
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

		c.JSON(http.StatusOK, gin.H{
			"token":  token,
			"userId": existingUser.ID,
		})
	}
}
