package auth

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	userModule "github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/Foodstream-io/etchebest/internal/notify"

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
	ProfileImage       []byte `json:"profileImage"`
	Description        string `json:"description" binding:"required,min=10" example:"I like eating sushi"`
	CountryNumberPhone int    `json:"countryNumberPhone" binding:"required,min=1" example:"33"`
	NumberPhone        string `json:"numberPhone" binding:"required,min=1" example:"123456"`
}

type RequestVerifyCode struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	Code   string `json:"code" binding:"required,min=4,max=8"`
}

type RequestResendCode struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
}

type RequestForgotPassword struct {
	Email string `json:"email" binding:"required,email" example:"user@example.com"`
}

type RequestResetPassword struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8" example:"Password123@"`
}

// isDevMode checks whether development mode helpers should be enabled.
// Secure by default: requires DEV_MODE="true" or "1" AND gin.Mode() != ReleaseMode.
func isDevMode() bool {
	devEnv := strings.ToLower(strings.TrimSpace(os.Getenv("DEV_MODE")))
	return (devEnv == "true" || devEnv == "1") && gin.Mode() != gin.ReleaseMode
}

// GenerateOTP generates a cryptographically secure 6-digit numeric string
func GenerateOTP() (string, error) {
	maxVal := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, maxVal)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func createAndSendVerificationCode(db *gorm.DB, n notify.Notifier, u *userModule.User) (*userModule.VerificationCode, error) {
	// Invalidate previous unused codes for this user
	db.Model(&userModule.VerificationCode{}).
		Where("user_id = ? AND used = ?", u.ID, false).
		Update("used", true)

	codeStr, err := GenerateOTP()
	if err != nil {
		return nil, fmt.Errorf("failed to generate OTP: %w", err)
	}

	vc := userModule.VerificationCode{
		ID:        uuid.New().String(),
		UserID:    u.ID,
		Code:      codeStr,
		Type:      userModule.VerificationTypeEmail,
		Target:    u.Email,
		ExpiresAt: time.Now().Add(15 * time.Minute),
		Used:      false,
		Attempts:  0,
	}

	if err := db.Create(&vc).Error; err != nil {
		return nil, fmt.Errorf("failed to save verification code: %w", err)
	}

	if err := n.SendVerificationEmail(u.Email, codeStr); err != nil {
		log.Printf("[NOTIFY ERROR] Failed to send verification email to %s: %v", u.Email, err)
	}

	return &vc, nil
}

// Register godoc
// @Summary      Register a new user
// @Description  Create a new user account and send an email verification code
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestRegister true "Registration details"
// @Success      200  {object}  map[string]interface{} "message: User registered, verification code sent"
// @Failure      400  {object}  map[string]string "error: Invalid request or User already exists"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/register [post]
func Register(db *gorm.DB) gin.HandlerFunc {
	notifier := notify.NewNotifier()

	return func(c *gin.Context) {
		var req RequestRegister

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
		cleanUsername := strings.TrimSpace(req.Username)

		// Check if an account already exists with this email (case-insensitive)
		var existingUser userModule.User
		if err := db.Where("LOWER(email) = ?", cleanEmail).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "this email is already being used",
				"code":  "EMAIL_ALREADY_EXISTS",
			})
			return
		}

		// Check if an account already exists with this username (case-insensitive)
		if cleanUsername != "" {
			if err := db.Where("LOWER(username) = ?", strings.ToLower(cleanUsername)).First(&existingUser).Error; err == nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "this username is already taken",
					"code":  "USERNAME_ALREADY_EXISTS",
				})
				return
			}
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error generating from password: ": err.Error()})
			return
		}

		user := userModule.User{
			ID:                 uuid.New().String(),
			Email:              cleanEmail,
			Password:           string(hashedPassword),
			FirstName:          strings.TrimSpace(req.FirstName),
			LastName:           strings.TrimSpace(req.LastName),
			Username:           cleanUsername,
			ProfileImageURL:    "",
			Description:        req.Description,
			CountryNumberPhone: req.CountryNumberPhone,
			NumberPhone:        strings.TrimSpace(req.NumberPhone),
			Role:               userModule.USER,
			IsAccountVerified:  false,
			IsEmailVerified:    false,
			IsPhoneVerified:    false,
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "this email is already being used",
				"code":  "EMAIL_ALREADY_EXISTS",
			})
			return
		}

		vc, err := createAndSendVerificationCode(db, notifier, &user)
		if err != nil {
			log.Printf("[REGISTER ERROR] Failed to create verification code: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send verification code"})
			return
		}

		response := gin.H{
			"message": "user registered successfully, verification code sent",
			"userId":  user.ID,
			"target":  notify.MaskEmail(user.Email),
		}

		// Return devCode if in dev mode
		if isDevMode() {
			response["devCode"] = vc.Code
		}

		c.JSON(http.StatusOK, response)
	}
}

// VerifyCode godoc
// @Summary      Verify registration code
// @Description  Verify the 6-digit OTP code sent via email and activate the account
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestVerifyCode true "Verification code details"
// @Success      200  {object}  map[string]interface{} "message: Account verified"
// @Failure      400  {object}  map[string]string "error: Invalid or expired code"
// @Failure      404  {object}  map[string]string "error: User not found"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/verify [post]
func VerifyCode(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RequestVerifyCode
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		var user userModule.User
		query := db
		if req.UserID != "" {
			query = query.Where("id = ?", req.UserID)
		} else if req.Email != "" {
			query = query.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.Email)))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId or email is required"})
			return
		}

		if err := query.First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		// If user is already verified, return JWT directly
		if user.IsAccountVerified {
			tokenString, err := GenerateJWT(&user, jwtKey)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"message": "account already verified",
				"token":   tokenString,
				"user": gin.H{
					"id":                user.ID,
					"email":             user.Email,
					"username":          user.Username,
					"firstName":         user.FirstName,
					"lastName":          user.LastName,
					"role":              user.Role,
					"isAccountVerified": true,
				},
			})
			return
		}

		var vc userModule.VerificationCode
		if err := db.Where("user_id = ? AND used = ?", user.ID, false).
			Order("created_at desc").
			First(&vc).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no active verification code found"})
			return
		}

		if time.Now().After(vc.ExpiresAt) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "verification code has expired"})
			return
		}

		if vc.Attempts >= 5 {
			db.Model(&vc).Update("used", true)
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many invalid attempts, please request a new code"})
			return
		}

		cleanInputCode := strings.TrimSpace(req.Code)
		if vc.Code != cleanInputCode {
			db.Model(&vc).Update("attempts", vc.Attempts+1)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid verification code"})
			return
		}

		// Mark code as used
		db.Model(&vc).Update("used", true)

		// Activate user
		updates := map[string]interface{}{
			"is_account_verified": true,
			"is_email_verified":   true,
		}

		if err := db.Model(&user).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate account"})
			return
		}

		user.IsAccountVerified = true
		user.IsEmailVerified = true

		tokenString, err := GenerateJWT(&user, jwtKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "account verified successfully",
			"token":   tokenString,
			"user": gin.H{
				"id":                user.ID,
				"email":             user.Email,
				"username":          user.Username,
				"firstName":         user.FirstName,
				"lastName":          user.LastName,
				"role":              user.Role,
				"isAccountVerified": true,
			},
		})
	}
}

// ResendVerificationCode godoc
// @Summary      Resend verification code
// @Description  Resend a new 6-digit OTP code to the user via email
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestResendCode true "Resend details"
// @Success      200  {object}  map[string]interface{} "message: Verification code resent"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Failure      429  {object}  map[string]string "error: Rate limit exceeded"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/resend-code [post]
func ResendVerificationCode(db *gorm.DB) gin.HandlerFunc {
	notifier := notify.NewNotifier()

	return func(c *gin.Context) {
		var req RequestResendCode
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		var user userModule.User
		query := db
		if req.UserID != "" {
			query = query.Where("id = ?", req.UserID)
		} else if req.Email != "" {
			query = query.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.Email)))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId or email is required"})
			return
		}

		if err := query.First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		if user.IsAccountVerified {
			c.JSON(http.StatusBadRequest, gin.H{"error": "account is already verified"})
			return
		}

		// Rate limit: check if a code was created in the last 60 seconds
		var latestVC userModule.VerificationCode
		err := db.Where("user_id = ?", user.ID).
			Order("created_at desc").
			First(&latestVC).Error
		if err == nil {
			timeSinceCreation := time.Since(latestVC.CreatedAt)
			if timeSinceCreation < 60*time.Second {
				remainingSecs := int((60*time.Second - timeSinceCreation).Seconds())
				c.JSON(http.StatusTooManyRequests, gin.H{
					"error":         fmt.Sprintf("please wait %d seconds before requesting a new code", remainingSecs),
					"retryAfterSec": remainingSecs,
				})
				return
			}
		}

		vc, err := createAndSendVerificationCode(db, notifier, &user)
		if err != nil {
			log.Printf("[RESEND ERROR] Failed to create code: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resend verification code"})
			return
		}

		response := gin.H{
			"message": "verification code resent successfully",
			"userId":  user.ID,
			"target":  notify.MaskEmail(user.Email),
		}

		if isDevMode() {
			response["devCode"] = vc.Code
		}

		c.JSON(http.StatusOK, response)
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
// @Failure      403  {object}  map[string]string "error: Account banned or not verified"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/login [post]
func Login(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RequestLogin

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
		var user userModule.User

		if err := db.Where("LOWER(email) = ?", cleanEmail).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}

		if user.IsCurrentlyBanned() {
			c.JSON(http.StatusForbidden, gin.H{
				"error":       "your account is banned",
				"banReason":   user.BanReason,
				"bannedUntil": user.BannedUntil,
			})
			return
		}

		// Check if account is verified (admins and accounts with IsAccountVerified = true are allowed)
		if !user.IsAccountVerified && user.Role != userModule.ADMIN {
			c.JSON(http.StatusForbidden, gin.H{
				"error":              "your account is not verified yet",
				"code":               "ACCOUNT_NOT_VERIFIED",
				"userId":             user.ID,
				"email":              user.Email,
				"countryNumberPhone": user.CountryNumberPhone,
				"numberPhone":        user.NumberPhone,
			})
			return
		}

		// Lazily lift temporary bans that have expired
		if user.IsBanned {
			if err := userModule.ClearBan(db, &user); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
				return
			}
		}

		tokenString, err := GenerateJWT(&user, jwtKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error new with claims: ": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": tokenString})
	}
}

// GenerateJWT creates a JWT token for authentication
func GenerateJWT(user *userModule.User, jwtKey []byte) (string, error) {
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
	return token.SignedString(jwtKey)
}

// ForgotPassword godoc
// @Summary      Forgot password request
// @Description  Send a password reset email if the user exists
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestForgotPassword true "Email address"
// @Success      200  {object}  map[string]interface{} "message: If an account exists, a reset link has been sent"
// @Failure      400  {object}  map[string]string "error: Invalid request"
// @Router       /api/auth/forgot-password [post]
func ForgotPassword(db *gorm.DB) gin.HandlerFunc {
	notifier := notify.NewNotifier()

	return func(c *gin.Context) {
		var req RequestForgotPassword
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

		genericResponse := gin.H{
			"message": "If an account exists with this email, a password reset link has been sent.",
		}

		var user userModule.User
		if err := db.Where("LOWER(email) = ?", cleanEmail).First(&user).Error; err != nil {
			// Do not leak whether the user exists
			c.JSON(http.StatusOK, genericResponse)
			return
		}

		// Cooldown check (60s) to prevent spamming and DoS on active reset tokens
		var latestToken userModule.PasswordResetToken
		if err := db.Where("user_id = ?", user.ID).Order("created_at desc").First(&latestToken).Error; err == nil {
			if time.Since(latestToken.CreatedAt) < 60*time.Second {
				c.JSON(http.StatusOK, genericResponse)
				return
			}
		}

		// Invalidate previous unused reset tokens for this user
		db.Model(&userModule.PasswordResetToken{}).
			Where("user_id = ? AND used = ?", user.ID, false).
			Update("used", true)

		tokenStr := uuid.New().String()
		resetToken := userModule.PasswordResetToken{
			ID:        uuid.New().String(),
			UserID:    user.ID,
			Email:     user.Email,
			Token:     tokenStr,
			ExpiresAt: time.Now().Add(30 * time.Minute),
			Used:      false,
		}

		if err := db.Create(&resetToken).Error; err != nil {
			log.Printf("[RESET ERROR] Failed to save reset token: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process request"})
			return
		}

		appURL := os.Getenv("APP_URL")
		if appURL == "" {
			appURL = "http://localhost:3000"
		}
		resetLink := fmt.Sprintf("%s/reset-password?token=%s", strings.TrimRight(appURL, "/"), tokenStr)

		if err := notifier.SendPasswordResetEmail(user.Email, resetLink); err != nil {
			log.Printf("[NOTIFY ERROR] Failed to send password reset email to %s: %v", user.Email, err)
		}

		// In dev mode, log the reset link to server console for testing without exposing in API response
		if isDevMode() {
			log.Printf("[DEV MODE] Password reset link for %s: %s", user.Email, resetLink)
		}

		c.JSON(http.StatusOK, genericResponse)
	}
}

// ResetPassword godoc
// @Summary      Reset password
// @Description  Reset user password using a valid reset token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RequestResetPassword true "Reset password details"
// @Success      200  {object}  map[string]string "message: Password reset successfully"
// @Failure      400  {object}  map[string]string "error: Invalid or expired token"
// @Failure      500  {object}  map[string]string "error: Internal server error"
// @Router       /api/auth/reset-password [post]
func ResetPassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RequestResetPassword
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		cleanToken := strings.TrimSpace(req.Token)
		if cleanToken == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
			return
		}

		var resetToken userModule.PasswordResetToken
		if err := db.Where("token = ? AND used = ?", cleanToken, false).First(&resetToken).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid or expired reset token",
				"code":  "INVALID_OR_EXPIRED_TOKEN",
			})
			return
		}

		if time.Now().After(resetToken.ExpiresAt) {
			db.Model(&resetToken).Update("used", true)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "this reset link has expired, please request a new one",
				"code":  "TOKEN_EXPIRED",
			})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		// Mark token as used
		db.Model(&resetToken).Update("used", true)

		// Update user password
		now := time.Now()
		updates := map[string]interface{}{
			"password":            string(hashedPassword),
			"password_updated_at": &now,
		}

		if err := db.Model(&userModule.User{}).Where("id = ?", resetToken.UserID).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "password reset successfully",
		})
	}
}
