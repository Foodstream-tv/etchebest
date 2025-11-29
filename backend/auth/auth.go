package auth

import (
	"net/http"
	"time"

	"github.com/Foodstream-io/etchebest/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

type Request struct {
	Email    string `json:"email" binding:"required,email" example:"user@example.com"`
	Password string `json:"password" binding:"required,min=8" example:"Password123@"`
}

/*
Register godoc
@Summary      Register a new user
@Description  Create a new user account with email and password
@Tags         auth
@Accept       json
@Produce      json
@Param        request body RegisterRequest true "Registration details"
@Success      200  {object}  map[string]string "message: User registered"
@Failure      400  {object}  map[string]string "error: Invalid request or User already exists"
@Failure      500  {object}  map[string]string "error: Internal server error"
@Router       /register [post]
*/
func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req Request

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error generating from password: ": err.Error()})
			return
		}

		user := models.User{
			ID:       uuid.New().String(),
			Email:    req.Email,
			Password: string(hashedPassword),
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "this email is already being used"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "user registered successfully"})
	}
}

/*
Login godoc
@Summary      Login user
@Description  Authenticate user and return JWT token
@Tags         auth
@Accept       json
@Produce      json
@Param        request body LoginRequest true "Login credentials"
@Success      200  {object}  map[string]string "token: JWT token string"
@Failure      400  {object}  map[string]string "error: Invalid request"
@Failure      401  {object}  map[string]string "error: User not found or Invalid password"
@Failure      500  {object}  map[string]string "error: Internal server error"
@Router       /login [post]
*/
func Login(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req Request

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		var user models.User

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
