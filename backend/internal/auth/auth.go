package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Foodstream-io/etchebest/internal/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Claims struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type RequestLogin struct {
	Email    string `json:"email" binding:"required,email" example:"user@example.com"`
	Password string `json:"password" binding:"required,min=8" example:"Password123@"`
}

type RequestRegister struct {
	Email              string `json:"email" binding:"required,email" example:"user@example.com"`
	Password           string `json:"password" binding:"required,min=8" example:"Password123@"`
	FirstName          string `json:"firstName" binding:"required,min=2" example:"John"`
	LastName           string `json:"lastName" binding:"required,min=2" example:"Doe"`
	Username           string `json:"username" binding:"required,min=2" example:"JohnDoe23"`
	ProfileImage       []byte `json:"profileImage" binding:"required"`
	Description        string `json:"description" binding:"required,min=10" example:"I like eating sushi"`
	CountryNumberPhone int    `json:"countryNumberPhone" binding:"required,min=1" example:"33"`
	NumberPhone        string `json:"numberPhone" binding:"required,min=1" example:"123456"`
}

// Register godoc
// @Summary      Register a new user
// @Description  Create a new user account with email and password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestRegister true "Registration details"
// @Success      200  {object}  map[string]string "message: User registered"
// @Failure      400  {object}  map[string]string "error: Invalid request or User already exists"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/register [post]
func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RequestRegister

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error generating from password: ": err.Error()})
			return
		}

		user := user.User{
			ID:                 uuid.New().String(),
			Email:              req.Email,
			Password:           string(hashedPassword),
			FirstName:          req.FirstName,
			LastName:           req.LastName,
			Username:           req.Username,
			ProfileImageURL:    "",
			Description:        req.Description,
			CountryNumberPhone: req.CountryNumberPhone,
			NumberPhone:        req.NumberPhone,
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "this email is already being used"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "user registered successfully"})
	}
}

// Login godoc
// @Summary      Login user
// @Description  Authenticate user and return JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestLogin true "Login credentials"
// @Success      200  {object}  map[string]string "token: JWT token string"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Failure      401  {object}  map[string]string "error: User not found or Invalid password"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/login [post]
func Login(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RequestLogin

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		var user user.User

		if err := db.Where("email = ?", req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}

		// 7 Days expiration token
		expiration := time.Now().Add(7 * 24 * time.Hour)
		claims := &Claims{
			UserID: user.ID,
			Role:   user.Role,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(expiration),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString(jwtKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error new with claims: ": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": tokenString})
	}
}

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

// generateJWT creates a JWT token for authentication
func generateJWT(user *user.User, jwtKey []byte) (string, error) {
	expiration := time.Now().Add(7 * 24 * time.Hour)
	claims := &Claims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiration),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
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
		token, err := generateJWT(&existingUser, jwtKey)
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
		token, err := generateJWT(&existingUser, jwtKey)
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
