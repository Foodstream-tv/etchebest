package live

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func seedLives(t *testing.T, db *gorm.DB, lives ...Live) {
	t.Helper()
	for i := range lives {
		if err := db.Create(&lives[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
}

func sorted(ids []string) []string {
	out := append([]string(nil), ids...)
	sort.Strings(out)
	return out
}

func TestTheUnauthenticatedListNeverReturnsDrafts(t *testing.T) {
	db := testDB(t)
	seedLives(t, db,
		Live{RoomID: "draft-1", Status: "draft", Title: "unpublished"},
		Live{RoomID: "sched-1", Status: "scheduled"},
		Live{RoomID: "live-1", Status: "live"},
		Live{RoomID: "ended-1", Status: "ended"},
	)

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{"", []string{"live-1", "sched-1"}},
		{"status=all", []string{"live-1", "sched-1"}},
		{"status=scheduled", []string{"sched-1"}},
		{"status=live", []string{"live-1"}},
		{"status=ended", []string{"ended-1"}},
	} {
		got, _ := listRoomIDs(t, db, tc.query)
		if !reflect.DeepEqual(sorted(got), tc.want) {
			t.Errorf("?%s = %v, want %v", tc.query, got, tc.want)
		}
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/lives", GetLives(db))
	for _, status := range []string{"draft", "DRAFT", "deleted", "ended' OR '1'='1", "scheduled,draft", " draft"} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/lives?status="+url.QueryEscape(status), nil))
		if w.Code != http.StatusBadRequest {
			t.Errorf("status=%q: %d, want 400 (%s)", status, w.Code, w.Body.String())
		}
	}
}

func TestAWithdrawnReplayIsNotListed(t *testing.T) {
	db := testDB(t)
	removed := time.Now().Add(-time.Hour)
	seedLives(t, db,
		Live{RoomID: "kept", Status: "ended", HasReplay: true, ReplayURL: "/replays-storage/kept/master.m3u8"},
		Live{RoomID: "no-replay", Status: "ended"}, // never had one: still listed, as before
		Live{RoomID: "withdrawn", Status: "ended", ReplayRemovedAt: &removed},
	)
	got, total := listRoomIDs(t, db, "status=ended")
	if want := []string{"kept", "no-replay"}; !reflect.DeepEqual(sorted(got), want) || total != 2 {
		t.Fatalf("listed %v (total %d), want %v", got, total, want)
	}
}

func TestSearchTextIsMatchedLiterally(t *testing.T) {
	db := testDB(t)
	seedLives(t, db,
		Live{RoomID: "percent", Status: "live", Title: "100% bio"},
		Live{RoomID: "plain", Status: "live", Title: "100 bio"},
		Live{RoomID: "underscore", Status: "live", Title: "a_b"},
		Live{RoomID: "other", Status: "live", Title: "axb"},
		Live{RoomID: "slash", Status: "live", Title: `back\slash`},
	)
	for q, want := range map[string][]string{
		"100%":  {"percent"},
		"a_b":   {"underscore"},
		`k\s`:   {"slash"},
		"%":     {"percent"},
		"_":     {"underscore"},
		"bio":   {"percent", "plain"},
		"axb":   {"other"},
		"%%%%%": nil,
	} {
		got, _ := listRoomIDs(t, db, "q="+url.QueryEscape(q))
		if !reflect.DeepEqual(sorted(got), want) && !(len(got) == 0 && len(want) == 0) {
			t.Errorf("q=%q listed %v, want %v", q, got, want)
		}
	}
}

func TestALongSearchTextIsCutNotRefused(t *testing.T) {
	db := testDB(t)
	seedLives(t, db, Live{RoomID: "any", Status: "live", Title: "anything"})
	long := make([]byte, 5000)
	for i := range long {
		long[i] = 'a'
	}
	listRoomIDs(t, db, "q="+string(long)) // must answer 200: it fails the test otherwise
	if got := LikePattern(string(long)); len(got) != maxSearchLength+2 {
		t.Fatalf("pattern length %d, want %d", len(got), maxSearchLength+2)
	}
}
