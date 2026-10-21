package audit

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

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
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS audit_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=audit_test"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Migrator().DropTable(&Entry{}); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&Entry{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func router(db *gorm.DB, actor string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if actor != "" {
			c.Set("userId", actor)
		}
	})
	g := r.Group("/api/admin", Middleware(db))
	g.GET("/users", func(c *gin.Context) { c.JSON(200, []string{}) })
	g.POST("/users/:userId/ban", func(c *gin.Context) { c.Status(204) })
	g.DELETE("/rooms/:roomId/chats/:chatId", func(c *gin.Context) { c.Status(http.StatusForbidden) })
	g.GET("/audit-logs", List(db))
	return r
}

func do(r *gin.Engine, method, url string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, url, nil)
	req.RemoteAddr = "203.0.113.7:1234"
	r.ServeHTTP(w, req)
	return w
}

func TestEveryAdminRequestIsRecordedWithoutItsQueryString(t *testing.T) {
	db := testDB(t)
	r := router(db, "admin-1")

	do(r, "GET", "/api/admin/users?search=jane.doe@example.com")
	do(r, "POST", "/api/admin/users/u-42/ban")
	do(r, "DELETE", "/api/admin/rooms/r-1/chats/c-9")

	var entries []Entry
	if err := db.Order("created_at asc").Find(&entries).Error; err != nil {
		t.Fatal(err)
	}
	if len(entries) != 3 {
		t.Fatalf("%d entries, want 3", len(entries))
	}
	want := []struct {
		method, route, target string
		status                int
	}{
		{"GET", "/api/admin/users", "", 200},
		{"POST", "/api/admin/users/:userId/ban", "u-42", 204},
		{"DELETE", "/api/admin/rooms/:roomId/chats/:chatId", "c-9", 403},
	}
	for i, w := range want {
		e := entries[i]
		if e.ActorID != "admin-1" || e.Method != w.method || e.Route != w.route || e.TargetID != w.target || e.Status != w.status || e.IP != "203.0.113.7" {
			t.Errorf("entry %d = %+v, want %+v by admin-1 from 203.0.113.7", i, e, w)
		}
	}
	raw, _ := json.Marshal(entries)
	if strings.Contains(string(raw), "jane.doe") {
		t.Error("the search term from the query string leaked into the journal")
	}
}

func TestUnauthenticatedRequestsAreNotRecorded(t *testing.T) {
	db := testDB(t)
	do(router(db, ""), "GET", "/api/admin/users")
	var n int64
	db.Model(&Entry{}).Count(&n)
	if n != 0 {
		t.Fatalf("%d entries for a request without an actor", n)
	}
}

func TestListFiltersAndPages(t *testing.T) {
	db := testDB(t)
	r := router(db, "admin-1")
	do(r, "POST", "/api/admin/users/u-1/ban")
	do(r, "POST", "/api/admin/users/u-2/ban")
	do(r, "POST", "/api/admin/users/u-2/ban")

	var got []Entry
	w := do(r, "GET", "/api/admin/audit-logs?targetId=u-2")
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Errorf("targetId filter: %d entries, want 2", len(got))
	}
	w = do(r, "GET", "/api/admin/audit-logs?limit=1")
	got = nil
	_ = json.Unmarshal(w.Body.Bytes(), &got)
	if len(got) != 1 {
		t.Errorf("limit=1: %d entries", len(got))
	}
}

func TestPurgeKeepsTheLastYear(t *testing.T) {
	db := testDB(t)
	now := time.Now()
	for id, age := range map[string]time.Duration{"old": Retention + 24*time.Hour, "recent": Retention - 24*time.Hour} {
		if err := db.Create(&Entry{ID: id, ActorID: "a", Method: "GET", Route: "/x", Status: 200, CreatedAt: now.Add(-age)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	n, err := Purge(db, now)
	if err != nil || n != 1 {
		t.Fatalf("purged %d, err %v, want 1", n, err)
	}
	var left []Entry
	db.Find(&left)
	if len(left) != 1 || left[0].ID != "recent" {
		t.Fatalf("left %+v", left)
	}
}
