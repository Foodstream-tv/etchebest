package room

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Foodstream-io/etchebest/internal/middleware"
	"github.com/gin-gonic/gin"
)

func iceRouter(user string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", user) })
	r.POST("/ice", HandleICECandidate(nil)) // nil database: the room is already in memory
	return r
}

func postICE(r *gin.Engine, roomID string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/ice?roomId="+roomID,
		bytes.NewBufferString(`{"candidate":"candidate:1 1 udp 2113937151 192.0.2.1 54400 typ host","sdpMid":"0","sdpMLineIndex":0}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func registerRoom(t *testing.T, id string) *Room {
	t.Helper()
	room := &Room{}
	setLiveRoom(id, room)
	t.Cleanup(func() { removeLiveRoom(id) })
	return room
}

func TestCandidatesWaitingForAPeerAreBoundedPerUser(t *testing.T) {
	room := registerRoom(t, "ice-user-cap")
	r := iceRouter("alice")

	for i := 0; i < maxPendingICEPerUser; i++ {
		if w := postICE(r, "ice-user-cap"); w.Code != http.StatusOK {
			t.Fatalf("candidate %d: status %d, want 200 while under the cap", i+1, w.Code)
		}
	}
	if w := postICE(r, "ice-user-cap"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("past the per-user cap: status %d, want 429", w.Code)
	}
	if got := len(room.PendingICEByUser["alice"]); got != maxPendingICEPerUser {
		t.Fatalf("%d candidates held, want exactly %d", got, maxPendingICEPerUser)
	}
	// Another user is not affected by alice's limit, and nobody can fill the room for the others.
	if w := postICE(iceRouter("bob"), "ice-user-cap"); w.Code != http.StatusOK {
		t.Fatalf("bob: status %d, want 200", w.Code)
	}
}

func TestAnOversizeCandidateIsAnsweredWith413(t *testing.T) {
	registerRoom(t, "ice-big")
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", "alice") })
	r.POST("/ice", middleware.LimitBody(2<<10), HandleICECandidate(nil))

	big := `{"candidate":"` + strings.Repeat("a", 1<<20) + `"}`
	for name, announce := range map[string]int64{"announced": int64(len(big)), "chunked": -1} {
		req := httptest.NewRequest(http.MethodPost, "/ice?roomId=ice-big", strings.NewReader(big))
		req.ContentLength = announce
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("%s: status %d, want 413", name, w.Code)
		}
	}
}
