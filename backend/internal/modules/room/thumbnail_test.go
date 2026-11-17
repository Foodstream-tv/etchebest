package room

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestValidThumbnailURL(t *testing.T) {
	valid := []string{
		"",
		"/api/uploads/3f2a9c1e-7b5d-4c0a-9d11-2f6b8e4a1c77.png",
		"https://example.com/cover.jpg",
		"https://cdn.example.com/a/b.webp?w=800",
		"http://example.com/cover.jpg", // the mobile Studio lets a user paste one
	}
	invalid := []string{
		"javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=",
		"file:///etc/passwd", "//example.com/cover.jpg", "https:///no-host", "https://user:pass@example.com/cover.jpg",
		"/api/uploads/../../etc/passwd", "/api/uploads/a.png?x=1", "/api/uploads/a\\b.png", "/other/path.png", "ftp://example.com/a.png",
		"/api/uploads/%2e%2e/%2e%2e/x.png", "/api/uploads/a/b.png", "/api/uploads//a.png", "/api/uploads/a.svg", "/api/uploads/a.png/", "/api/uploads/",
		"https://example.com/" + strings.Repeat("a", maxThumbnailURLLength),
	}
	for _, u := range valid {
		if !validThumbnailURL(u) {
			t.Errorf("%q must be accepted", u)
		}
	}
	for _, u := range invalid {
		if validThumbnailURL(u) {
			t.Errorf("%q must be refused", u)
		}
	}
}

// A nil database: an invalid thumbnail is answered before anything is created.
func TestCreateRoomRefusesAnInvalidThumbnailBeforeTheDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", "u1") })
	r.POST("/rooms", CreateNewRoom(nil))
	req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewBufferString(`{"name":"Brunch","thumbnailUrl":"javascript:alert(1)"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "invalid thumbnail URL") {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
}
