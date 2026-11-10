package hls

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func liveTree(t *testing.T, room string, segments int) {
	t.Helper()
	t.Chdir(t.TempDir())
	for _, q := range []string{"720p", "480p"} {
		dir := filepath.Join("hls", room, q)
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "index.m3u8"), []byte(eventPlaylist(segments, false)), 0644); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "segment_003.ts"), []byte("TSDATA"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	files := map[string]string{
		"master.m3u8": "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n720p/index.m3u8\n",
		"stream.sdp":  "v=0 SECRET-INPUT\n",
		"notes.txt":   "private",
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join("hls", room, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join("hls", "outside.txt"), []byte("not in a room"), 0644); err != nil {
		t.Fatal(err)
	}
}

func get(r *gin.Engine, method, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return w
}

func liveRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/api/hls")
	g.GET("/*filepath", ServeLive())
	g.HEAD("/*filepath", ServeLive())
	return r
}

func TestMediaPlaylistsAreServedAsAWindow(t *testing.T) {
	liveTree(t, "room-1", 40)
	w := get(liveRouter(), http.MethodGet, "/api/hls/room-1/720p/index.m3u8")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/vnd.apple.mpegurl" {
		t.Errorf("content type %q", ct)
	}
	body := w.Body.String()
	if got := segmentsOf(body); len(got) != defaultLiveWindow || got[0] != "segment_030.ts" {
		t.Errorf("served %d segments from %v, want the last %d (030 to 039)", len(got), got, defaultLiveWindow)
	}
	if !strings.Contains(body, "MEDIA-SEQUENCE:30") {
		t.Errorf("media sequence missing:\n%s", body)
	}
	// the file on disk is untouched: the replay is built from the complete one
	disk, _ := os.ReadFile(filepath.Join("hls", "room-1", "720p", "index.m3u8"))
	if len(segmentsOf(string(disk))) != 40 {
		t.Error("serving a window must not rewrite the complete playlist")
	}
}

func TestTheWindowSizeFollowsTheSetting(t *testing.T) {
	t.Setenv("HLS_LIVE_WINDOW", "5")
	liveTree(t, "room-1", 40)
	w := get(liveRouter(), http.MethodGet, "/api/hls/room-1/480p/index.m3u8")
	if got := segmentsOf(w.Body.String()); len(got) != 5 {
		t.Errorf("%d segments, want 5", len(got))
	}
}

func TestMasterPlaylistAndSegmentsAreServedAsTheyAre(t *testing.T) {
	liveTree(t, "room-1", 12)
	r := liveRouter()
	if w := get(r, http.MethodGet, "/api/hls/room-1/master.m3u8"); w.Code != 200 || !strings.Contains(w.Body.String(), "720p/index.m3u8") {
		t.Errorf("master: %d %q", w.Code, w.Body.String())
	}
	if w := get(r, http.MethodGet, "/api/hls/room-1/720p/segment_003.ts"); w.Code != 200 || w.Body.String() != "TSDATA" {
		t.Errorf("segment: %d %q", w.Code, w.Body.String())
	}
	if w := get(r, http.MethodHead, "/api/hls/room-1/720p/segment_003.ts"); w.Code != 200 {
		t.Errorf("HEAD segment: %d", w.Code)
	}
	if w := get(r, http.MethodGet, "/api/hls/room-1/720p/segment_999.ts"); w.Code != http.StatusNotFound {
		t.Errorf("missing segment: %d, want 404", w.Code)
	}
}

func TestOnlyWhatAPlayerFetchesIsServed(t *testing.T) {
	liveTree(t, "room-1", 12)
	r := liveRouter()
	for name, path := range map[string]string{
		"the SDP":              "/api/hls/room-1/stream.sdp",
		"a stray file":         "/api/hls/room-1/notes.txt",
		"a directory listing":  "/api/hls/room-1/",
		"a quality directory":  "/api/hls/room-1/720p/",
		"a file outside rooms": "/api/hls/outside.txt",
		"the root":             "/api/hls/",
		"traversal":            "/api/hls/room-1/../outside.txt",
		"encoded traversal":    "/api/hls/room-1/%2e%2e/outside.txt",
		"traversal as room":    "/api/hls/../room-1/master.m3u8",
		"quality traversal":    "/api/hls/room-1/..p/index.m3u8",
		"odd segment name":     "/api/hls/room-1/720p/segment_x.ts",
		"a playlist elsewhere": "/api/hls/room-1/720p/other.m3u8",
		"a too deep path":      "/api/hls/room-1/720p/a/index.m3u8",
		"an unknown room":      "/api/hls/room-2/master.m3u8",
		"a bad room id":        "/api/hls/room.1/master.m3u8",
	} {
		if w := get(r, http.MethodGet, path); w.Code != http.StatusNotFound && w.Code != http.StatusMovedPermanently {
			t.Errorf("%s (%s): status %d, want 404", name, path, w.Code)
		} else if strings.Contains(w.Body.String(), "SECRET-INPUT") || strings.Contains(w.Body.String(), "private") || strings.Contains(w.Body.String(), "not in a room") {
			t.Errorf("%s (%s): leaked a file", name, path)
		}
	}
}

func TestAFinishedPlaylistStillServedIsWhole(t *testing.T) {
	liveTree(t, "room-1", 12)
	end := eventPlaylist(40, true)
	if err := os.WriteFile(filepath.Join("hls", "room-1", "720p", "index.m3u8"), []byte(end), 0644); err != nil {
		t.Fatal(err)
	}
	w := get(liveRouter(), http.MethodGet, "/api/hls/room-1/720p/index.m3u8")
	if got := segmentsOf(w.Body.String()); len(got) != 40 {
		t.Errorf("a finished playlist must be whole, got %d segments", len(got))
	}
}
