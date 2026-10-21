package middleware

import (
	"net/url"
	"os"
	"strings"

	"github.com/Foodstream-io/etchebest/internal/auth"
	"github.com/gin-gonic/gin"
)

// credentialedOrigins are the web apps allowed to call the API with their session cookie:
// ALLOWED_REDIRECT_ORIGINS (default APP_URL) plus CORS_ALLOWED_ORIGINS.
func credentialedOrigins() []string {
	origins := auth.AllowedOrigins()
	for _, o := range strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",") {
		o = strings.TrimSpace(o)
		if o != "" && o != "*" {
			origins = append(origins, strings.ToLower(o))
		}
	}
	return origins
}

func isCredentialedOrigin(origin string) bool {
	origin = strings.ToLower(origin)
	if auth.IsDevMode() && isLocalOrigin(origin) {
		return true // any local port while developing (front 3000, analytics 3001, a spare 3002...)
	}
	for _, o := range credentialedOrigins() {
		if o == origin {
			return true
		}
	}
	return false
}

func isLocalOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	h := u.Hostname()
	return h == "localhost" || h == "127.0.0.1"
}

func CorsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		if origin := c.GetHeader("Origin"); origin != "" && isCredentialedOrigin(origin) {
			// The web apps authenticate with a cookie: the browser only sends it, and lets the page
			// read the answer, for an explicitly allowed origin (never with "*").
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Add("Vary", "Origin")
		} else {
			h.Set("Access-Control-Allow-Origin", "*")
			h.Del("Access-Control-Allow-Credentials")
		}
		h.Set("Access-Control-Allow-Headers", "Content-type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		h.Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
