package hls

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func HLSAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("room")
		token := c.Query("token")

		if !ValidateToken(roomID, token) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired stream token",
			})
			return
		}

		c.Next()
	}
}
