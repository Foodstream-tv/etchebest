package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// limitedRouter echoes how many bytes the handler managed to read, and whether reading failed.
func limitedRouter(max int64, exempt ...string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(LimitBody(max, exempt...))
	read := func(c *gin.Context) {
		b, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "read failed", "read": len(b)})
			return
		}
		c.JSON(http.StatusOK, gin.H{"read": len(b)})
	}
	r.POST("/small", read)
	r.POST("/upload", read)
	r.GET("/empty", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	return r
}

func post(r *gin.Engine, path string, body io.Reader, contentLength int64) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, body)
	req.ContentLength = contentLength // -1: unknown length, as with chunked transfer
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestLimitBodyRefusesAnAnnouncedOversizeBodyWithoutReadingIt(t *testing.T) {
	w := post(limitedRouter(16), "/small", strings.NewReader(strings.Repeat("x", 17)), 17)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", w.Code)
	}
}

func TestLimitBodyCutsAStreamThatLiesAboutItsLength(t *testing.T) {
	// No announced length: the reader itself must stop at the limit.
	w := post(limitedRouter(16), "/small", strings.NewReader(strings.Repeat("x", 1<<20)), -1)
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "read failed") {
		t.Fatalf("a body past the limit must fail to read: %d %s", w.Code, w.Body.String())
	}
	// And it must not have been buffered whole: at most the limit was handed out.
	if strings.Contains(w.Body.String(), `"read":1048576`) {
		t.Fatalf("the whole body was read: %s", w.Body.String())
	}
}

func TestLimitBodyLetsABodyUnderTheLimitThrough(t *testing.T) {
	for _, n := range []int{0, 1, 16} {
		w := post(limitedRouter(16), "/small", strings.NewReader(strings.Repeat("x", n)), int64(n))
		if w.Code != http.StatusOK {
			t.Fatalf("%d bytes: status = %d, want 200 (%s)", n, w.Code, w.Body.String())
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/empty", nil)
	w := httptest.NewRecorder()
	limitedRouter(16).ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Fatalf("a request without a body must pass: %d", w.Code)
	}
}

func TestLimitBodySkipsExemptPaths(t *testing.T) {
	r := limitedRouter(16, "/upload")
	if w := post(r, "/upload", strings.NewReader(strings.Repeat("x", 100)), 100); w.Code != http.StatusOK {
		t.Fatalf("an exempt path keeps its own limit: %d", w.Code)
	}
	if w := post(r, "/small", strings.NewReader(strings.Repeat("x", 100)), 100); w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("a path that is not exempt is capped: %d", w.Code)
	}
}

func TestStackedLimitsTheTighterOneWins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(LimitBody(1 << 20))
	r.POST("/tight", LimitBody(8), func(c *gin.Context) {
		if _, err := io.ReadAll(c.Request.Body); err != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		c.Status(http.StatusOK)
	})
	if w := post(r, "/tight", strings.NewReader(strings.Repeat("x", 100)), -1); w.Code != http.StatusBadRequest {
		t.Fatalf("the route limit must apply under the global one: %d", w.Code)
	}
}
