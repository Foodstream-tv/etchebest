package middleware

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// LimitBody caps the size of a request body. A client that announces more than max bytes is refused at
// once with 413; one that sends more than it announced (or streams with no length) gets its body cut at
// max, so reading it fails instead of filling the server's memory.
//
// Paths in exempt are left alone: they have a limit of their own (set on their route).
func LimitBody(max int64, exempt ...string) gin.HandlerFunc {
	skip := make(map[string]bool, len(exempt))
	for _, p := range exempt {
		skip[p] = true
	}
	return func(c *gin.Context) {
		if skip[c.Request.URL.Path] || c.Request.Body == nil || c.Request.Body == http.NoBody {
			c.Next()
			return
		}
		if c.Request.ContentLength > max {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, max)
		c.Next()
	}
}

// IsBodyTooLarge reports whether a body-reading error (for example from ShouldBindJSON) comes from LimitBody
// cutting the body, so a handler can answer 413 instead of treating it as malformed input.
func IsBodyTooLarge(err error) bool {
	var tooLarge *http.MaxBytesError
	return errors.As(err, &tooLarge)
}
