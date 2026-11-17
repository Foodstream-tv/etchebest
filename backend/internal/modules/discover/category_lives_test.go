package discover

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
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
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS discover_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=discover_test"), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
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

func TestACountryPageNeverListsDraftsOrWithdrawnReplays(t *testing.T) {
	db := testDB(t)
	jp := country.Country{Name: "Japon", IsActive: true}
	if err := db.Create(&jp).Error; err != nil {
		t.Fatal(err)
	}
	removed := time.Now().Add(-time.Hour)
	for _, l := range []live.Live{
		{RoomID: "draft", Status: "draft", CountryID: jp.ID},
		{RoomID: "withdrawn", Status: "ended", CountryID: jp.ID, ReplayRemovedAt: &removed},
		{RoomID: "live", Status: "live", CountryID: jp.ID},
		{RoomID: "ended", Status: "ended", CountryID: jp.ID},
	} {
		l := l
		if err := db.Create(&l).Error; err != nil {
			t.Fatal(err)
		}
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/categories/:id/lives", GetCategoryLives(db))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/categories/1/lives", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var body struct {
		Lives []struct {
			RoomID string `json:"room_id"`
		} `json:"lives"`
		Pagination struct {
			Total int64 `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, l := range body.Lives {
		got[l.RoomID] = true
	}
	if !got["live"] || !got["ended"] || got["draft"] || got["withdrawn"] || len(got) != 2 || body.Pagination.Total != 2 {
		t.Fatalf("listed %v (total %d), want only live and ended", got, body.Pagination.Total)
	}
}
