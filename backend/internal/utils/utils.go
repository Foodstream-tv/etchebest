package utils

import (
	"github.com/gin-gonic/gin"
)

func GetContextString(c *gin.Context, key string) string {
	res, _ := c.Get(key)
	return res.(string)
}
