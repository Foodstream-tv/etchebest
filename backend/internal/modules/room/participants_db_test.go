package room

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set: skipping the Postgres integration test")
	}
	// Packages run in parallel against the same database: each one works in its own schema.
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS room_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=room_test"), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Migrator().DropTable(&user.User{}, &Room{}); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&user.User{}, &Room{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestGetRoomReturnsUsernamesAndConnectedCount(t *testing.T) {
	db := testDB(t)
	for _, u := range []user.User{
		{ID: "host-id", Email: "h@example.com", Password: "x", Username: "chef"},
		{ID: "alice-id", Email: "a@example.com", Password: "x", Username: "alice"},
		{ID: "ghost-id", Email: "g@example.com", Password: "x", Username: "ghosty"},
	} {
		u := u
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
	}
	stored := Room{ID: "room-names", Name: "Tarte", Host: "host-id", Participants: pq.StringArray{"host-id", "alice-id", "ghost-id"}, MaxParticipants: 5}
	if err := db.Create(&stored).Error; err != nil {
		t.Fatal(err)
	}

	// in memory: the host and alice have a peer connection, ghosty never connected
	live := &Room{ID: "room-names", Host: "host-id", Participants: stored.Participants, Connections: []PeerConnection{
		{UserID: "host-id", PeerCon: fakePC()},
		{UserID: "alice-id", PeerCon: fakePC()},
	}}
	setLiveRoom("room-names", live)
	defer removeLiveRoom("room-names")

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/rooms/:roomId", GetRoom(db))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/rooms/room-names", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}

	var got struct {
		ID               string   `json:"id"`
		Participants     []string `json:"participants"`
		MaxParticipants  int      `json:"maxParticipants"`
		ConnectedCount   int      `json:"connectedCount"`
		ParticipantsInfo []struct {
			ID        string `json:"id"`
			Username  string `json:"username"`
			Role      string `json:"role"`
			Connected bool   `json:"connected"`
		} `json:"participantsInfo"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != "room-names" || got.MaxParticipants != 5 || len(got.Participants) != 3 {
		t.Errorf("the stored room fields must stay: %+v", got)
	}
	if got.ConnectedCount != 1 {
		t.Errorf("connectedCount = %d, want 1 (alice)", got.ConnectedCount)
	}
	byName := map[string]bool{}
	for _, p := range got.ParticipantsInfo {
		byName[p.Username] = p.Connected
		if p.Username == "" {
			t.Errorf("every participant must have a name here: %+v", p)
		}
	}
	if !byName["chef"] || !byName["alice"] || byName["ghosty"] {
		t.Errorf("connected flags = %v, want chef and alice connected, ghosty not", byName)
	}
}

func TestGetRoomForAnUnknownRoomIs404(t *testing.T) {
	db := testDB(t)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/rooms/:roomId", GetRoom(db))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/rooms/nope", nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("status %d, want 404", w.Code)
	}
}
