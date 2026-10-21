package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// SessionTTL is how long a session token (JWT and cookie) stays valid.
const SessionTTL = 7 * 24 * time.Hour

// SessionCookieName is the cookie the web apps authenticate with.
const SessionCookieName = "token"

func isSecureRequest(c *gin.Context) bool {
	return c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https"
}

// SetSessionCookie stores the session token in an httpOnly cookie, so scripts of the web apps never
// read it. With remember=false it is a session cookie (gone when the browser closes).
func SetSessionCookie(c *gin.Context, token string, remember bool) {
	maxAge := 0
	if remember {
		maxAge = int(SessionTTL.Seconds())
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(SessionCookieName, token, maxAge, "/", "", isSecureRequest(c), true)
}

// ClearSessionCookie removes the session cookie (and the legacy auth_token one).
func ClearSessionCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(SessionCookieName, "", -1, "/", "", isSecureRequest(c), true)
	c.SetCookie("auth_token", "", -1, "/", "", isSecureRequest(c), true)
}
