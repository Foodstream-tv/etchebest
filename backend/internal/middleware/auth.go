package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/Foodstream-io/etchebest/internal/auth"
	"github.com/Foodstream-io/etchebest/internal/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

func AuthMiddleware(jwtKey []byte, db *gorm.DB) gin.HandlerFunc {
	const BearerPrefix = "Bearer "
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			if cookieToken, err := c.Cookie("token"); err == nil && cookieToken != "" {
				authHeader = BearerPrefix + cookieToken
			} else if cookieToken, err := c.Cookie("auth_token"); err == nil && cookieToken != "" {
				authHeader = BearerPrefix + cookieToken
			}
		}

		if authHeader == "" || !strings.HasPrefix(authHeader, BearerPrefix) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid token"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, BearerPrefix)
		claims := &auth.Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		currentUser, err := user.GetUserByID(db, claims.UserID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		if sessionPredatesPassword(claims, currentUser.PasswordUpdatedAt) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		if currentUser.IsCurrentlyBanned() {
			c.JSON(http.StatusForbidden, gin.H{
				"error":       "your account is banned",
				"banReason":   currentUser.BanReason,
				"bannedUntil": currentUser.BannedUntil,
			})
			c.Abort()
			return
		}

		c.Set("userId", claims.UserID)
		// Use the role from the database so promotions/demotions apply
		// immediately instead of waiting for the JWT to expire.
		c.Set("role", currentUser.Role)
		c.Next()
	}
}

func RequireRole(required string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := c.Get("role")
		if !ok || role != required {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "you don't have permission to access this resource",
			})
			return
		}
		c.Next()
	}
}

// sessionPredatesPassword reports whether a session was issued before the last change of the password, so a
// stolen session does not survive the owner changing or resetting it. Milliseconds are compared (tokens keep
// them, see auth.init): the token handed back by the change itself is issued after it and stays valid. A token
// with no issue time cannot be dated, so it counts as older.
func sessionPredatesPassword(claims *auth.Claims, passwordUpdatedAt *time.Time) bool {
	if passwordUpdatedAt == nil {
		return false // accounts that never recorded a password date keep their sessions
	}
	if claims.IssuedAt == nil {
		return true
	}
	// A token is read back from a floating-point number of seconds, which can lose a millisecond: one
	// millisecond of tolerance keeps the token a change hands back from being refused by rounding.
	return claims.IssuedAt.Time.Add(time.Millisecond).Before(passwordUpdatedAt.Truncate(time.Millisecond))
}
