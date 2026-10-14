package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

func serve(t *testing.T, live bool, name string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, name), []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	g := r.Group("/media", MediaHeaders(live))
	g.Static("/", dir)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/media/"+name, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET %s = %d", name, w.Code)
	}
	return w
}

func TestMediaHeadersLive(t *testing.T) {
	playlist := serve(t, true, "index.m3u8")
	if got := playlist.Header().Get("Content-Type"); got != "application/vnd.apple.mpegurl" {
		t.Fatalf("playlist content type = %q", got)
	}
	if got := playlist.Header().Get("Cache-Control"); got != "no-cache, no-store, must-revalidate" {
		t.Fatalf("live playlist must not be cached, got %q", got)
	}

	segment := serve(t, true, "index0.ts")
	if got := segment.Header().Get("Content-Type"); got != "video/mp2t" {
		t.Fatalf("segment content type = %q", got)
	}
	if got := segment.Header().Get("Cache-Control"); got != "public, max-age=30" {
		t.Fatalf("live segment cache = %q", got)
	}
}

func TestMediaHeadersReplay(t *testing.T) {
	playlist := serve(t, false, "master.m3u8")
	if got := playlist.Header().Get("Cache-Control"); got != "public, max-age=3600" {
		t.Fatalf("replay playlist cache = %q", got)
	}
	segment := serve(t, false, "index0.ts")
	if got := segment.Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Fatalf("replay segment cache = %q", got)
	}
	mp4 := serve(t, false, "legacy.mp4")
	if got := mp4.Header().Get("Content-Type"); got != "video/mp4" {
		t.Fatalf("mp4 content type = %q", got)
	}
}

func TestMediaHeadersLeaveOtherFilesAlone(t *testing.T) {
	w := serve(t, true, "stream.sdp")
	if got := w.Header().Get("Cache-Control"); got != "" {
		t.Fatalf("unrelated file should keep default caching, got %q", got)
	}
}
