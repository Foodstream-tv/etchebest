package search

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/live"
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
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS search_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=search_test"), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	models := []any{&user.User{}, &live.Live{}, &live.RecordingConsent{}, &tag.Tag{}, &dish.Dish{}, &country.Country{}}
	if err := db.Migrator().DropTable(append(models, "live_tags")...); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Migrator().DropTable(append(models, "live_tags")...) })
	return db
}

func searchRoomIDs(t *testing.T, db *gorm.DB, q string) []string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/search", GlobalSearch(db))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/search?q="+url.QueryEscape(q), nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		Lives []struct {
			RoomID string `json:"room_id"`
		} `json:"lives"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for _, l := range body.Lives {
		ids = append(ids, l.RoomID)
	}
	sort.Strings(ids)
	return ids
}

func TestSearchNeverReturnsDraftsOrWithdrawnReplays(t *testing.T) {
	db := testDB(t)
	removed := time.Now().Add(-time.Hour)
	for _, l := range []live.Live{
		{RoomID: "draft", Status: "draft", Title: "ramen secret"},
		{RoomID: "withdrawn", Status: "ended", Title: "ramen retiré", ReplayRemovedAt: &removed},
		{RoomID: "scheduled", Status: "scheduled", Title: "ramen prévu"},
		{RoomID: "live", Status: "live", Title: "ramen en direct"},
		{RoomID: "ended", Status: "ended", Title: "ramen terminé"},
	} {
		l := l
		if err := db.Create(&l).Error; err != nil {
			t.Fatal(err)
		}
	}
	got := searchRoomIDs(t, db, "ramen")
	want := []string{"ended", "live", "scheduled"}
	if len(got) != len(want) {
		t.Fatalf("found %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("found %v, want %v", got, want)
		}
	}
}

func TestSearchTextIsMatchedLiterally(t *testing.T) {
	db := testDB(t)
	for _, l := range []live.Live{
		{RoomID: "percent", Status: "live", Title: "100% bio"},
		{RoomID: "plain", Status: "live", Title: "100 bio"},
		{RoomID: "underscore", Status: "live", Title: "a_b"},
		{RoomID: "other", Status: "live", Title: "axb"},
	} {
		l := l
		if err := db.Create(&l).Error; err != nil {
			t.Fatal(err)
		}
	}
	if got := searchRoomIDs(t, db, "100%"); len(got) != 1 || got[0] != "percent" {
		t.Fatalf("100%% found %v, want only the live with a literal percent sign", got)
	}
	if got := searchRoomIDs(t, db, "a_b"); len(got) != 1 || got[0] != "underscore" {
		t.Fatalf("a_b found %v, want only the live with a literal underscore", got)
	}
}
