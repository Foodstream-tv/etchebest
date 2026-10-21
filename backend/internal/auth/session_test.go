package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func sessionCookie(t *testing.T, w *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, ck := range w.Result().Cookies() {
		if ck.Name == SessionCookieName {
			return ck
		}
	}
	t.Fatal("no session cookie in the response")
	return nil
}

func serve(h gin.HandlerFunc, req *http.Request) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/", h)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestSessionCookieIsHttpOnlyAndLax(t *testing.T) {
	w := serve(func(c *gin.Context) { SetSessionCookie(c, "jwt", true) }, httptest.NewRequest(http.MethodGet, "/", nil))
	ck := sessionCookie(t, w)
	if ck.Value != "jwt" || !ck.HttpOnly || ck.SameSite != http.SameSiteLaxMode || ck.Path != "/" {
		t.Errorf("cookie %+v", ck)
	}
	if ck.MaxAge != int(SessionTTL.Seconds()) {
		t.Errorf("max-age %d, want the JWT lifetime %d", ck.MaxAge, int(SessionTTL.Seconds()))
	}
	if ck.Secure {
		t.Error("plain http must not set Secure (the cookie would never come back in local dev)")
	}
}

func TestSessionCookieIsSecureBehindHTTPS(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	ck := sessionCookie(t, serve(func(c *gin.Context) { SetSessionCookie(c, "jwt", true) }, req))
	if !ck.Secure {
		t.Error("the cookie must be Secure behind https")
	}
}

func TestSessionCookieWithoutRememberMeEndsWithTheBrowserSession(t *testing.T) {
	ck := sessionCookie(t, serve(func(c *gin.Context) { SetSessionCookie(c, "jwt", false) }, httptest.NewRequest(http.MethodGet, "/", nil)))
	if ck.MaxAge != 0 || !ck.Expires.IsZero() {
		t.Errorf("expected a session cookie, got max-age %d expires %v", ck.MaxAge, ck.Expires)
	}
}

func TestClearSessionCookie(t *testing.T) {
	ck := sessionCookie(t, serve(func(c *gin.Context) { ClearSessionCookie(c) }, httptest.NewRequest(http.MethodGet, "/", nil)))
	if ck.Value != "" || ck.MaxAge >= 0 {
		t.Errorf("cookie not cleared: %+v", ck)
	}
}
