package auth

import (
	"net/http"
	"time"

	userModule "github.com/Foodstream-io/etchebest/internal/modules/user"
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

// NewSessionIssuer starts a new session for a user whose earlier sessions were just ended (a password
// change): a token for API clients and, for browsers, a browser-session cookie (whether the user had
// asked to be remembered is not known here, and a shorter session is the safer default).
func NewSessionIssuer(jwtKey []byte) userModule.SessionIssuer {
	return func(c *gin.Context, u *userModule.User) (string, error) {
		token, err := GenerateJWT(u, jwtKey)
		if err != nil {
			return "", err
		}
		SetSessionCookie(c, token, false)
		return token, nil
	}
}
