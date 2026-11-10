package hls

import (
	"math/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestContainedIn(t *testing.T) {
	root := t.TempDir()
	t.Chdir(root)
	cases := []struct {
		file string
		want bool
	}{
		{"hls/room-1/master.m3u8", true},
		{"./hls/room-1/720p/segment_001.ts", true},
		{"hls/room-1/../room-2/master.m3u8", true}, // cleaned, still inside
		{"hls/../secret.txt", false},
		{"hls/room-1/../../secret.txt", false},
		{"hls-evil/master.m3u8", false}, // a sibling sharing the prefix is not inside
		{"hls", false},                  // the base itself is not a file of it
		{"secret.txt", false},
		{"/etc/passwd", false},
	}
	for _, c := range cases {
		got := containedIn("./hls", c.file)
		if (got != "") != c.want {
			t.Errorf("containedIn(hls, %q) = %q, inside = %v want %v", c.file, got, got != "", c.want)
		}
		if got != "" && (!filepath.IsAbs(got) || got != filepath.Clean(got)) {
			t.Errorf("containedIn(hls, %q) = %q: must be absolute and clean", c.file, got)
		}
	}
}

// Attacks on the live file server: a secret sits next to the live tree, and nothing but the playlists and
// segments of a live may come out of it.
func TestServeLiveCannotLeaveTheLiveTree(t *testing.T) {
	root := t.TempDir()
	t.Chdir(root)
	write := func(name, content string) {
		if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(name, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("secret.txt", "SECRET")
	write("hls-evil/room-1/master.m3u8", "SECRET")
	write("hls/room-1/master.m3u8", "#EXTM3U\n")
	write("hls/room-1/720p/segment_001.ts", "TS")
	write("hls/room-1/stream.sdp", "SECRET")
	write("hls/room-1/720p/stream.sdp", "SECRET")

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/hls/*filepath", ServeLive())
	get := func(p string) (int, string) {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.URL.Path = "/api/hls/" + p // the raw bytes reach the handler, whatever a URL parser would say
		r.ServeHTTP(w, req)
		return w.Code, w.Body.String()
	}

	if c, b := get("room-1/master.m3u8"); c != http.StatusOK || !strings.Contains(b, "EXTM3U") {
		t.Fatalf("a master playlist must be served: %d %q", c, b)
	}
	if c, b := get("room-1/720p/segment_001.ts"); c != http.StatusOK || b != "TS" {
		t.Fatalf("a segment must be served: %d %q", c, b)
	}

	attacks := []string{
		"../secret.txt", "room-1/../../secret.txt", "room-1/720p/../../../secret.txt", "..%2fsecret.txt", "%2e%2e/secret.txt",
		"room-1/720p/segment_001.ts/../../../../secret.txt", "room-1/720p/..\\..\\secret.txt", "room-1\\..\\secret.txt",
		"../hls-evil/room-1/master.m3u8", "room-1/stream.sdp", "room-1/720p/stream.sdp", "room-1/", "room-1", "", "/", "//secret.txt",
		"room-1//master.m3u8/../../secret.txt", "room-1/720p/segment_1.ts\x00.png", "room-1/720p/segment_1111111111.ts",
		"room-1/72p/segment_001.ts", "room-1/7200p0/segment_001.ts", "room-1/720p/segment_001.ts.bak", "room-1/720p/Segment_001.ts",
		".\x00./secret.txt", "room-1/./master.m3u8", "./room-1/master.m3u8", "room-1/720p/index.m3u8/../../../secret.txt",
		"room-1%2f..%2f..%2fsecret.txt", "ro om-1/master.m3u8", "room-1/master.m3u8\x00",
	}
	for _, a := range attacks {
		c, b := get(a)
		if strings.Contains(b, "SECRET") {
			t.Errorf("a file outside the served set came out with %q: %d %q", a, c, b)
		}
		if c == http.StatusOK {
			t.Errorf("%q must not be served", a)
		}
	}

	// Whatever the input, a path liveFile accepts is one of the three served shapes, inside hls/<room>/.
	alphabet := []string{".", "..", "/", "\\", "%2e", "%2f", "room-1", "720p", "segment_", "001", ".ts", "index.m3u8", "master.m3u8", "\x00", " ", "a", "-", "_", "~", "‮"}
	rng := rand.New(rand.NewSource(1))
	base, _ := filepath.Abs(liveDir)
	for i := 0; i < 100000; i++ {
		var sb strings.Builder
		for j, n := 0, 1+rng.Intn(9); j < n; j++ {
			sb.WriteString(alphabet[rng.Intn(len(alphabet))])
		}
		f, _ := liveFile(sb.String())
		if f == "" {
			continue
		}
		rel, err := filepath.Rel(base, mustAbs(f))
		if err != nil || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
			t.Fatalf("input %q gave %q, outside the live tree", sb.String(), f)
		}
		if parts := strings.Split(rel, string(filepath.Separator)); len(parts) < 2 || len(parts) > 3 || !roomIDPattern.MatchString(parts[0]) {
			t.Fatalf("input %q gave %q: not a served shape", sb.String(), f)
		}
	}
}

func mustAbs(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		panic(err)
	}
	return abs
}
