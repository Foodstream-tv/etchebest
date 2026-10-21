package live

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set: skipping the Postgres integration test")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS live_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=live_test"), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	models := []any{&user.User{}, &Live{}, &RecordingConsent{}, &tag.Tag{}, &dish.Dish{}, &country.Country{}}
	if err := db.Migrator().DropTable(append(models, "live_tags")...); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatal(err)
	}
	return db
}

func removalRouter(db *gorm.DB, userID string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if userID != "" {
			c.Set("userId", userID)
		}
	})
	r.POST("/lives/:id/replay/removal", RemoveReplay(db))
	return r
}

func post(r *gin.Engine, url string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, url, nil))
	return w
}

func replayFixture(t *testing.T, db *gorm.DB, roomID string) Live {
	t.Helper()
	dir := filepath.Join("storage", "replays", roomID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "master.m3u8"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	l := Live{RoomID: roomID, Title: "Tarte", UserID: "host", Status: "ended", HasReplay: true, ReplayURL: "/api/replays/" + roomID + "/master.m3u8"}
	if err := db.Create(&l).Error; err != nil {
		t.Fatal(err)
	}
	return l
}

func TestAPersonInTheReplayCanHaveItRemoved(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())
	l := replayFixture(t, db, "room-1")
	if err := RecordConsent(db, "room-1", "alice", time.Now()); err != nil {
		t.Fatal(err)
	}

	w := post(removalRouter(db, "alice"), "/lives/room-1/replay/removal")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d (%s)", w.Code, w.Body.String())
	}

	var got Live
	db.First(&got, l.ID)
	if got.HasReplay || got.ReplayURL != "" || got.ReplayRemovedAt == nil || got.ReplayRemovedBy != "alice" {
		t.Errorf("the replay must be unpublished and traced: %+v", got)
	}
	if got.Title != "Tarte" || got.Status != "ended" {
		t.Error("the live itself must stay")
	}
	if _, err := os.Stat(filepath.Join("storage", "replays", "room-1")); !os.IsNotExist(err) {
		t.Error("the files of the replay must be deleted")
	}
	if !LiveToDTO(got).ReplayRemoved || LiveToDTO(got).HasReplay {
		t.Error("the DTO must say the replay was removed")
	}

	// asking again is harmless and does not rewrite who removed it
	if w := post(removalRouter(db, "host"), "/lives/room-1/replay/removal"); w.Code != http.StatusOK {
		t.Fatalf("second removal: %d", w.Code)
	}
	db.First(&got, l.ID)
	if got.ReplayRemovedBy != "alice" {
		t.Errorf("removed by %q, want alice (first removal wins)", got.ReplayRemovedBy)
	}
}

func TestTheHostCanRemoveItByNumericId(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())
	l := replayFixture(t, db, "room-2")
	w := post(removalRouter(db, "host"), "/lives/"+itoa(l.ID)+"/replay/removal")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d (%s)", w.Code, w.Body.String())
	}
}

func TestStrangersAndAnonymousCannotRemoveAReplay(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())
	replayFixture(t, db, "room-3")
	// somebody who consented to ANOTHER live is not in this one
	if err := RecordConsent(db, "other-room", "mallory", time.Now()); err != nil {
		t.Fatal(err)
	}
	for user, want := range map[string]int{"mallory": http.StatusForbidden, "": http.StatusUnauthorized} {
		if w := post(removalRouter(db, user), "/lives/room-3/replay/removal"); w.Code != want {
			t.Errorf("user %q: status %d, want %d", user, w.Code, want)
		}
	}
	if w := post(removalRouter(db, "host"), "/lives/unknown/replay/removal"); w.Code != http.StatusNotFound {
		t.Errorf("unknown live: %d, want 404", w.Code)
	}
	var got Live
	db.Where("room_id = ?", "room-3").First(&got)
	if !got.HasReplay || got.ReplayRemovedAt != nil {
		t.Error("a refused request must change nothing")
	}
}

func TestConsentIsRecordedOnceAndFound(t *testing.T) {
	db := testDB(t)
	first := time.Now().Add(-time.Hour)
	if err := RecordConsent(db, "r", "u", first); err != nil {
		t.Fatal(err)
	}
	if err := RecordConsent(db, "r", "u", time.Now()); err != nil {
		t.Fatal(err)
	}
	var rows []RecordingConsent
	db.Find(&rows)
	if len(rows) != 1 || !rows[0].ConsentedAt.Before(time.Now().Add(-30*time.Minute)) {
		t.Fatalf("rows %+v: one row, with the first date", rows)
	}
	if ok, _ := HasConsented(db, "r", "u"); !ok {
		t.Error("HasConsented must find it")
	}
	if ok, _ := HasConsented(db, "r", "someone"); ok {
		t.Error("another person did not consent")
	}
	if !IsRecorded(db, "no-live-row") {
		t.Error("a room without live row counts as recorded")
	}
}

func itoa(n uint) string { return strconv.FormatUint(uint64(n), 10) }
