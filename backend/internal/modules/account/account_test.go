package account

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/modules/activity"
	"github.com/Foodstream-io/etchebest/internal/modules/chat"
	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/room"
	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestUploadFilename(t *testing.T) {
	cases := map[string]string{
		"/api/uploads/abc.png":                        "abc.png",
		"https://foodstream.tv/api/uploads/abc.png":   "abc.png",
		"http://localhost:8081/api/uploads/a.jpg?x=1": "a.jpg",
		"https://lh3.googleusercontent.com/a/photo":   "",
		"":                              "",
		"/api/uploads/":                 "",
		"/api/uploads/../../etc/passwd": "",
		"/api/uploads/sub/dir.png":      "",
		"/api/uploads/..":               "",
	}
	for in, want := range cases {
		if got := uploadFilename(in); got != want {
			t.Errorf("uploadFilename(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRemoveReplayDirRefusesPathTricks(t *testing.T) {
	dir := t.TempDir()
	prev, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(prev)

	keep := filepath.Join(dir, "storage", "keep.txt")
	_ = os.MkdirAll(filepath.Dir(keep), 0o755)
	_ = os.WriteFile(keep, []byte("x"), 0o644)
	for _, bad := range []string{"..", "../keep.txt", "a/b", "."} {
		removeReplayDir(bad)
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatalf("a path trick removed files outside the replays directory: %v", err)
	}
}

// testDB connects to a throwaway Postgres (TEST_DATABASE_DSN), recreating the schema.
// The test is skipped when the variable is not set.
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set: skipping the Postgres integration test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	models := []any{
		&user.User{}, &user.VerificationCode{}, &user.PasswordResetToken{}, &room.Room{},
		&country.Country{}, &dish.Dish{}, &live.Live{}, &tag.Tag{}, &chat.Chat{}, &activity.Activity{},
	}
	if err := db.Migrator().DropTable(append(models, "live_tags")...); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatal(err)
	}
	return db
}

func newUser(t *testing.T, db *gorm.DB, id string, mod func(*user.User)) {
	t.Helper()
	u := user.User{ID: id, Email: id + "@example.com", Password: "hash", Username: id, FirstName: "First " + id}
	if mod != nil {
		mod(&u)
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
}

func count(t *testing.T, db *gorm.DB, table, where string, args ...any) int64 {
	t.Helper()
	var n int64
	if err := db.Table(table).Where(where, args...).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func seed(t *testing.T, db *gorm.DB) {
	t.Helper()
	newUser(t, db, "alice", func(u *user.User) {
		u.ProfileImageURL = "/api/uploads/alice-avatar.png"
		u.FollowingIDS = pq.StringArray{"bob"}
		u.FollowersIDS = pq.StringArray{"bob"}
		u.NumberPhone = "0600000000"
	})
	newUser(t, db, "bob", func(u *user.User) {
		u.FollowingIDS = pq.StringArray{"alice", "carol"}
		u.FollowersIDS = pq.StringArray{"alice", "carol"}
		u.FollowerCount = 2
	})
	newUser(t, db, "carol", func(u *user.User) {
		u.FollowingIDS = pq.StringArray{"bob"}
		u.FollowersIDS = pq.StringArray{"bob", "alice"}
		u.FollowerCount = 2
	})
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(db.Create(&live.Live{RoomID: "room-alice", Title: "Alice live", UserID: "alice", ThumbnailURL: "/api/uploads/alice-thumb.png", Status: "ended"}).Error)
	must(db.Create(&live.Live{RoomID: "room-bob", Title: "Bob live", UserID: "bob", Status: "ended"}).Error)
	must(db.Create(&room.Room{ID: "room-alice", Name: "Alice live", Host: "alice", Participants: pq.StringArray{"alice", "bob"}}).Error)
	must(db.Create(&room.Room{ID: "room-bob", Name: "Bob live", Host: "bob", Participants: pq.StringArray{"bob", "alice", "carol"}}).Error)
	must(db.Create(&chat.Chat{ID: "c1", UserID: "alice", RoomID: "room-bob", Message: "hi from alice"}).Error)
	must(db.Create(&chat.Chat{ID: "c2", UserID: "bob", RoomID: "room-bob", Message: "hi from bob"}).Error)
	must(db.Create(&activity.Activity{ID: "a1", UserID: "alice", ActorID: "bob", Type: "follow", Text: "bob follows you", CreatedAt: time.Now()}).Error)
	must(db.Create(&activity.Activity{ID: "a2", UserID: "bob", ActorID: "alice", Type: "follow", Text: "alice follows you", CreatedAt: time.Now()}).Error)
	must(db.Create(&activity.Activity{ID: "a3", UserID: "carol", ActorID: "bob", Type: "follow", Text: "bob follows you", CreatedAt: time.Now()}).Error)
	must(db.Create(&user.VerificationCode{ID: "v1", UserID: "alice", Code: "123456", Type: "email", Target: "alice@example.com", ExpiresAt: time.Now().Add(time.Hour)}).Error)
	must(db.Create(&user.PasswordResetToken{ID: "p1", UserID: "alice", Email: "alice@example.com", Token: "tok", ExpiresAt: time.Now().Add(time.Hour)}).Error)
}

func TestEraseUserRemovesAllPersonalData(t *testing.T) {
	db := testDB(t)
	seed(t, db)

	dir := t.TempDir()
	prev, _ := os.Getwd()
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(prev)
	for _, f := range []string{"storage/uploads/alice-avatar.png", "storage/uploads/alice-thumb.png", "storage/uploads/bob-avatar.png", "storage/replays/room-alice/master.m3u8", "storage/replays/room-bob/master.m3u8"} {
		_ = os.MkdirAll(filepath.Dir(f), 0o755)
		_ = os.WriteFile(f, []byte("x"), 0o644)
	}

	if err := EraseUser(db, "alice"); err != nil {
		t.Fatal(err)
	}

	checks := map[string]int64{
		"users":                 count(t, db, "users", "id = ?", "alice"),
		"lives":                 count(t, db, "lives", "user_id = ?", "alice"),
		"rooms hosted":          count(t, db, "rooms", "host = ?", "alice"),
		"chats":                 count(t, db, "chats", "user_id = ?", "alice"),
		"activities as target":  count(t, db, "activities", "user_id = ?", "alice"),
		"activities as actor":   count(t, db, "activities", "actor_id = ?", "alice"),
		"verification codes":    count(t, db, "verification_codes", "user_id = ?", "alice"),
		"password reset tokens": count(t, db, "password_reset_tokens", "user_id = ?", "alice"),
		"in participants":       count(t, db, "rooms", "? = ANY(participants)", "alice"),
		"in following":          count(t, db, "users", "? = ANY(following_id_s)", "alice"),
		"in followers":          count(t, db, "users", "? = ANY(followers_id_s)", "alice"),
	}
	for what, n := range checks {
		if n != 0 {
			t.Errorf("%s: %d row(s) of alice's left", what, n)
		}
	}

	// other users' data is untouched
	if n := count(t, db, "users", "id IN ?", []string{"bob", "carol"}); n != 2 {
		t.Errorf("bob and carol must remain, got %d", n)
	}
	if n := count(t, db, "lives", "user_id = ?", "bob"); n != 1 {
		t.Error("bob's live must remain")
	}
	if n := count(t, db, "chats", "user_id = ?", "bob"); n != 1 {
		t.Error("bob's chat must remain")
	}
	if n := count(t, db, "activities", "id = ?", "a3"); n != 1 {
		t.Error("unrelated activity must remain")
	}

	var bob, carol user.User
	_ = db.First(&bob, "id = ?", "bob").Error
	_ = db.First(&carol, "id = ?", "carol").Error
	if len(bob.FollowersIDS) != 1 || bob.FollowersIDS[0] != "carol" || bob.FollowerCount != 1 {
		t.Errorf("bob's followers should be [carol] with count 1, got %v / %d", bob.FollowersIDS, bob.FollowerCount)
	}
	if len(carol.FollowersIDS) != 1 || carol.FollowersIDS[0] != "bob" || carol.FollowerCount != 1 {
		t.Errorf("carol's followers should be [bob] with count 1, got %v / %d", carol.FollowersIDS, carol.FollowerCount)
	}
	var roomBob room.Room
	_ = db.First(&roomBob, "id = ?", "room-bob").Error
	if strings.Join(roomBob.Participants, ",") != "bob,carol" {
		t.Errorf("room-bob participants should be bob,carol, got %v", roomBob.Participants)
	}

	for f, wantGone := range map[string]bool{
		"storage/uploads/alice-avatar.png":     true,
		"storage/uploads/alice-thumb.png":      true,
		"storage/replays/room-alice":           true,
		"storage/uploads/bob-avatar.png":       false,
		"storage/replays/room-bob/master.m3u8": false,
	} {
		_, err := os.Stat(f)
		if gone := os.IsNotExist(err); gone != wantGone {
			t.Errorf("%s: gone=%v, want %v", f, gone, wantGone)
		}
	}

	if err := EraseUser(db, "alice"); err != ErrUserNotFound {
		t.Errorf("erasing a missing user should return ErrUserNotFound, got %v", err)
	}
}

func TestExportMeHasEverythingAndNoSecrets(t *testing.T) {
	db := testDB(t)
	seed(t, db)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/export", func(c *gin.Context) { c.Set("userId", "alice"); ExportMe(db)(c) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/export", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Header().Get("Content-Disposition"), "attachment") {
		t.Error("the export must be served as a download")
	}
	body := w.Body.String()
	for _, secret := range []string{"hash", "123456", "tok\""} {
		if strings.Contains(body, secret) {
			t.Errorf("the export leaks %q", secret)
		}
	}

	var got Export
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Profile.Email != "alice@example.com" || got.Profile.NumberPhone != "0600000000" {
		t.Errorf("profile incomplete: %+v", got.Profile)
	}
	if len(got.Lives) != 1 || got.Lives[0].Title != "Alice live" {
		t.Errorf("lives: %+v", got.Lives)
	}
	if len(got.ChatMessage) != 1 || got.ChatMessage[0].Message != "hi from alice" {
		t.Errorf("chat: %+v", got.ChatMessage)
	}
	if len(got.Received) != 1 || len(got.Performed) != 1 {
		t.Errorf("activities: received %d performed %d", len(got.Received), len(got.Performed))
	}
	if len(got.FollowingID) != 1 || got.FollowingID[0] != "bob" || len(got.FollowersID) != 1 {
		t.Errorf("follow lists: %v / %v", got.FollowingID, got.FollowersID)
	}

	// someone else's data never shows up
	if strings.Contains(body, "hi from bob") || strings.Contains(body, "Bob live") {
		t.Error("the export contains another user's data")
	}
}

func TestPurgeExpiredCredentials(t *testing.T) {
	db := testDB(t)
	newUser(t, db, "alice", nil)
	now := time.Now()
	mk := func(id string, expires time.Time, used bool, created time.Time) {
		t.Helper()
		if err := db.Create(&user.VerificationCode{ID: "v-" + id, UserID: "alice", Code: id, Type: "email", Target: "alice@example.com", ExpiresAt: expires, Used: used, CreatedAt: created}).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&user.PasswordResetToken{ID: "p-" + id, UserID: "alice", Email: "alice@example.com", Token: "tok-" + id, ExpiresAt: expires, Used: used, CreatedAt: created}).Error; err != nil {
			t.Fatal(err)
		}
	}
	mk("fresh", now.Add(10*time.Minute), false, now)                          // still valid: kept
	mk("expired-recently", now.Add(-time.Hour), false, now.Add(-2*time.Hour)) // inside the grace period: kept
	mk("expired-old", now.Add(-48*time.Hour), false, now.Add(-49*time.Hour))  // purged
	mk("used-old", now.Add(10*time.Minute), true, now.Add(-30*time.Hour))     // used long ago: purged
	mk("used-recently", now.Add(10*time.Minute), true, now.Add(-time.Hour))   // kept

	n, err := PurgeExpiredCredentials(db, now)
	if err != nil {
		t.Fatal(err)
	}
	if n != 4 { // two rows per scenario, two scenarios purged
		t.Errorf("removed %d rows, want 4", n)
	}
	for id, want := range map[string]int64{"fresh": 1, "expired-recently": 1, "used-recently": 1, "expired-old": 0, "used-old": 0} {
		if got := count(t, db, "verification_codes", "id = ?", "v-"+id); got != want {
			t.Errorf("verification code %s: %d row(s), want %d", id, got, want)
		}
		if got := count(t, db, "password_reset_tokens", "id = ?", "p-"+id); got != want {
			t.Errorf("reset token %s: %d row(s), want %d", id, got, want)
		}
	}
}
