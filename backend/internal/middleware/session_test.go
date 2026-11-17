package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/auth"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var sessionKey = []byte("session-test-key")

func sessionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set: skipping the Postgres integration test")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS middleware_session_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=middleware_session_test"), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Migrator().DropTable(&user.User{}); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&user.User{}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Migrator().DropTable(&user.User{}) })
	return db
}

// newSessionUser creates a user whose password was last changed at changedAt (nil: never recorded).
func newSessionUser(t *testing.T, db *gorm.DB, id string, changedAt *time.Time) user.User {
	t.Helper()
	hash, _ := bcrypt.GenerateFromPassword([]byte("old-password-1"), bcrypt.MinCost)
	u := user.User{ID: id, Email: id + "@example.com", Username: id, FirstName: "F", LastName: "L", Password: string(hash)}
	if err := db.Create(&u).Error; err != nil { // BeforeCreate stamps the password date with now
		t.Fatal(err)
	}
	if err := db.Model(&u).UpdateColumn("password_updated_at", changedAt).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

// tokenIssuedAt signs a session for the user as if it had been issued at the given moment (nil: no issue time).
func tokenIssuedAt(t *testing.T, u user.User, issuedAt *time.Time) string {
	t.Helper()
	claims := &auth.Claims{UserID: u.ID, Role: u.Role, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}}
	if issuedAt != nil {
		claims.IssuedAt = jwt.NewNumericDate(*issuedAt)
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(sessionKey)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func sessionRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api", AuthMiddleware(sessionKey, db))
	api.GET("/me", func(c *gin.Context) { c.Status(http.StatusOK) })
	api.PATCH("/users/me/password", user.UpdateCurrentPassword(db, auth.NewSessionIssuer(sessionKey)))
	return r
}

func callWith(r *gin.Engine, method, path, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestASessionOlderThanThePasswordIsRefused(t *testing.T) {
	db := sessionTestDB(t)
	changed := time.Now().Add(-time.Minute).Truncate(time.Millisecond)
	u := newSessionUser(t, db, "alice", &changed)
	r := sessionRouter(db)

	at := func(d time.Duration) *time.Time { v := changed.Add(d); return &v }
	cases := []struct {
		name     string
		issuedAt *time.Time
		want     int
	}{
		{"issued before the change", at(-10 * time.Second), http.StatusUnauthorized},
		{"issued 5 ms before the change", at(-5 * time.Millisecond), http.StatusUnauthorized},
		{"issued at the moment of the change", at(0), http.StatusOK},
		{"issued after the change", at(30 * time.Second), http.StatusOK},
		{"no issue time at all", nil, http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if w := callWith(r, http.MethodGet, "/api/me", tokenIssuedAt(t, u, tc.issuedAt), ""); w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}

func TestAnAccountWithoutAPasswordDateKeepsItsSessions(t *testing.T) {
	db := sessionTestDB(t)
	u := newSessionUser(t, db, "legacy", nil)
	if w := callWith(sessionRouter(db), http.MethodGet, "/api/me", tokenIssuedAt(t, u, nil), ""); w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
}

func TestChangingThePasswordEndsTheOtherSessionsAndKeepsThisOne(t *testing.T) {
	db := sessionTestDB(t)
	changed := time.Now().Add(-time.Minute)
	u := newSessionUser(t, db, "bob", &changed)
	r := sessionRouter(db)

	thisDevice := time.Now().Add(-30 * time.Second)
	stolen := time.Now().Add(-5 * time.Second)
	current := tokenIssuedAt(t, u, &thisDevice)
	other := tokenIssuedAt(t, u, &stolen)
	for name, tok := range map[string]string{"this device": current, "another session": other} {
		if w := callWith(r, http.MethodGet, "/api/me", tok, ""); w.Code != http.StatusOK {
			t.Fatalf("%s before the change: %d, want 200", name, w.Code)
		}
	}

	w := callWith(r, http.MethodPatch, "/api/users/me/password", current, `{"currentPassword":"old-password-1","newPassword":"new-password-2"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("changing the password: %d %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	fresh, _ := resp["token"].(string)
	if fresh == "" {
		t.Fatalf("the change must hand back a new session: %s", w.Body.String())
	}
	if len(w.Result().Cookies()) == 0 {
		t.Fatal("the change must set the new session cookie for browsers")
	}

	if w := callWith(r, http.MethodGet, "/api/me", current, ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("the old token of this device: %d, want 401", w.Code)
	}
	if w := callWith(r, http.MethodGet, "/api/me", other, ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("another session issued before the change: %d, want 401", w.Code)
	}
	if w := callWith(r, http.MethodGet, "/api/me", fresh, ""); w.Code != http.StatusOK {
		t.Fatalf("the new session: %d, want 200", w.Code)
	}
}
