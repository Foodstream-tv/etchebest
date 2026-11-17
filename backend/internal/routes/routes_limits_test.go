package routes

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// Routes only registers handlers: the database is not touched until a request gets through authentication.
func limitedApp() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	Routes(r, nil, "test-secret", "", "")
	return r
}

func postBody(r *gin.Engine, path string, size int) int {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(strings.Repeat("x", size)))
	req.ContentLength = int64(size)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestEveryRouteIsCappedExceptTheUploadWhichHasItsOwnLimit(t *testing.T) {
	r := limitedApp()
	// 2 MiB is over the default cap but under the upload one.
	if code := postBody(r, "/api/login", 2<<20); code != http.StatusRequestEntityTooLarge {
		t.Fatalf("login with a 2 MiB body: %d, want 413", code)
	}
	if code := postBody(r, "/api/uploads/image", 2<<20); code == http.StatusRequestEntityTooLarge {
		t.Fatal("the image upload must accept a 2 MiB body: the exemption no longer matches the route")
	}
	// Without a session the upload is refused by authentication before its body is read at all.
	if code := postBody(r, "/api/uploads/image", 7<<20); code != http.StatusUnauthorized {
		t.Fatalf("an anonymous upload: %d, want 401", code)
	}
}
