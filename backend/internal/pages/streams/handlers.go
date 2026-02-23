package streams

import (
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
	"github.com/gin-gonic/gin"
)

func GetStreamToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Param("roomId")

		token := hls.GenerateToken(roomID, 30*time.Minute)

		c.JSON(200, gin.H{
			"token":     token,
			"expiresIn": 1800,
		})
	}
}
