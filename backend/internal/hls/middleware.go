package hls

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func HLSAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Path is /hls/{roomId}/..., extract the first segment after /hls/
		trimmed := strings.TrimPrefix(c.Request.URL.Path, "/hls/")
		roomID := strings.SplitN(trimmed, "/", 2)[0]
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
