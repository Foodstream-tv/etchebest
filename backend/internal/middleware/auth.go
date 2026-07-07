package middleware

import (
	"net/http"
	"strings"

	"github.com/Foodstream-io/etchebest/internal/auth"
	"github.com/Foodstream-io/etchebest/internal/modules/user"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

func AuthMiddleware(jwtKey []byte, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			queryToken := c.Query("token")
			if queryToken != "" {
				authHeader = "Bearer " + queryToken
			}
		}

		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid token"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
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
