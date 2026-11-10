package live

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func listRoomIDs(t *testing.T, db *gorm.DB, query string) (ids []string, total int64) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/lives", GetLives(db))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/lives?"+query, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d (%s)", w.Code, w.Body.String())
	}
	var body struct {
		Lives []struct {
			RoomID string `json:"room_id"`
		} `json:"lives"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	for _, l := range body.Lives {
		ids = append(ids, l.RoomID)
	}
	return ids, body.Total
}

func TestReplaysAreListedNewestFirstAndPagesDoNotOverlap(t *testing.T) {
	db := testDB(t)
	now := time.Now()
	at := func(d time.Duration) *time.Time { v := now.Add(d); return &v }
	tie := at(-30 * time.Minute) // one instant shared by two lives
	lives := []Live{
		{RoomID: "old", Status: "ended", EndedAt: at(-72 * time.Hour)},
		{RoomID: "mid", Status: "ended", EndedAt: at(-2 * time.Hour)},
		{RoomID: "new", Status: "ended", EndedAt: at(-10 * time.Minute)},
		// Ended before the end date was recorded: falls back on the creation date.
		{RoomID: "no-end-date", Status: "ended", CreatedAt: now.Add(-24 * time.Hour)},
		// Two ended at the same instant: the later row comes first, always.
		{RoomID: "tie-a", Status: "ended", EndedAt: tie},
		{RoomID: "tie-b", Status: "ended", EndedAt: tie},
	}
	for i := range lives {
		if err := db.Create(&lives[i]).Error; err != nil {
			t.Fatal(err)
		}
	}

	want := []string{"new", "tie-b", "tie-a", "mid", "no-end-date", "old"}
	got, total := listRoomIDs(t, db, "status=ended")
	if !reflect.DeepEqual(got, want) || total != int64(len(want)) {
		t.Fatalf("replays must be newest first\n got  %v (total %d)\n want %v", got, total, want)
	}

	// Pages of 4 then 2: together exactly the same list, no row twice, none missing.
	page1, _ := listRoomIDs(t, db, "status=ended&limit=4&page=1")
	page2, _ := listRoomIDs(t, db, "status=ended&limit=4&page=2")
	if joined := append(page1, page2...); !reflect.DeepEqual(joined, want) {
		t.Errorf("pages must follow one another without overlap: %v + %v", page1, page2)
	}
}

func TestUpcomingLivesKeepTheSoonestFirst(t *testing.T) {
	db := testDB(t)
	now := time.Now()
	at := func(d time.Duration) *time.Time { v := now.Add(d); return &v }
	for _, l := range []Live{
		{RoomID: "later", Status: "scheduled", ScheduledAt: at(48 * time.Hour)},
		{RoomID: "soon", Status: "scheduled", ScheduledAt: at(2 * time.Hour)},
		{RoomID: "on-air", Status: "live", CreatedAt: now.Add(-time.Hour)},
		{RoomID: "done", Status: "ended", EndedAt: at(-time.Hour)},
	} {
		l := l
		if err := db.Create(&l).Error; err != nil {
			t.Fatal(err)
		}
	}
	got, _ := listRoomIDs(t, db, "")
	if want := []string{"on-air", "soon", "later"}; !reflect.DeepEqual(got, want) {
		t.Errorf("upcoming lives must stay soonest first and exclude the ended ones: got %v, want %v", got, want)
	}
}
