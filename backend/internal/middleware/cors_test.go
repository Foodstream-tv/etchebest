package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func corsHeaders(t *testing.T, origin string) http.Header {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CorsHandler())
	r.GET("/x", func(c *gin.Context) { c.Status(200) })
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Header()
}

func TestCorsCredentialsOnlyForAllowedOrigins(t *testing.T) {
	t.Setenv("ALLOWED_REDIRECT_ORIGINS", "https://foodstream.live")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://analytics.foodstream.live, *")

	for _, origin := range []string{"https://foodstream.live", "https://analytics.foodstream.live"} {
		h := corsHeaders(t, origin)
		if h.Get("Access-Control-Allow-Origin") != origin || h.Get("Access-Control-Allow-Credentials") != "true" {
			t.Errorf("%s: origin %q credentials %q", origin, h.Get("Access-Control-Allow-Origin"), h.Get("Access-Control-Allow-Credentials"))
		}
		if h.Get("Vary") != "Origin" {
			t.Errorf("%s: missing Vary: Origin", origin)
		}
	}

	for _, origin := range []string{"https://evil.test", "https://foodstream.live.evil.test", ""} {
		h := corsHeaders(t, origin)
		if h.Get("Access-Control-Allow-Origin") != "*" {
			t.Errorf("%q: allow-origin %q, want *", origin, h.Get("Access-Control-Allow-Origin"))
		}
		if h.Get("Access-Control-Allow-Credentials") != "" {
			t.Errorf("%q: credentials must not be allowed", origin)
		}
	}
}

func TestCorsAllowsAnyLocalPortOnlyInDevMode(t *testing.T) {
	t.Setenv("ALLOWED_REDIRECT_ORIGINS", "https://foodstream.live")
	t.Setenv("DEV_MODE", "true")
	gin.SetMode(gin.TestMode) // not release mode
	if h := corsHeaders(t, "http://localhost:3002"); h.Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("dev mode: a local port must be allowed")
	}
	if h := corsHeaders(t, "https://evil.test"); h.Get("Access-Control-Allow-Credentials") != "" {
		t.Error("dev mode must not open anything but localhost")
	}
	t.Setenv("DEV_MODE", "false")
	if h := corsHeaders(t, "http://localhost:3002"); h.Get("Access-Control-Allow-Credentials") != "" {
		t.Error("without dev mode, only configured origins are allowed")
	}
}
