package room

import (
	"net/http"
	"testing"

	"bytes"
	"encoding/json"
	"github.com/Foodstream-io/etchebest/internal/hls"
	liveModule "github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"gorm.io/gorm"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
)

// consentFixture stores a scheduled live (recorded or not) with the host only.
func consentFixture(t *testing.T, db *gorm.DB, roomID string, replayDisabled bool) {
	t.Helper()
	for _, id := range []string{"host", "alice", "bob"} {
		u := user.User{ID: id + "-" + roomID, Email: id + roomID + "@example.com", Password: "x", Username: id + roomID}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
	}
	room := Room{ID: roomID, Name: "Tarte", Host: "host", Participants: pq.StringArray{"host"}, MaxParticipants: 5}
	if err := db.Create(&room).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&liveModule.Live{RoomID: roomID, Title: "Tarte", UserID: "host", Status: "scheduled", ReplayDisabled: replayDisabled}).Error; err != nil {
		t.Fatal(err)
	}
	live := room
	setLiveRoom(roomID, &live)
	t.Cleanup(func() { removeLiveRoom(roomID) })
}

func reserve(db *gorm.DB, user, roomID string, body any) *httptest.ResponseRecorder {
	return postOffer(webrtcRouter(db, user), "/rooms/"+roomID+"/reserve", body)
}

func codeOf(w *httptest.ResponseRecorder) string {
	var out struct {
		Code string `json:"code"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return out.Code
}

func TestReservingARecordedLiveNeedsTheConsent(t *testing.T) {
	db := testDB(t)
	consentFixture(t, db, "room-rec", false)

	for name, body := range map[string]any{"no body": nil, "false": map[string]bool{"consentToRecording": false}} {
		w := reserve(db, "alice", "room-rec", body)
		if w.Code != http.StatusBadRequest || codeOf(w) != codeRecordingConsentRequired {
			t.Fatalf("%s: status %d code %q, want 400 %s (%s)", name, w.Code, codeOf(w), codeRecordingConsentRequired, w.Body.String())
		}
	}
	stored, _ := GetRoomById(db, "room-rec")
	if coStreamerCount(stored) != 0 {
		t.Fatal("a refused reservation must not take a place")
	}
	if ok, _ := liveModule.HasConsented(db, "room-rec", "alice"); ok {
		t.Fatal("no consent must be recorded when the person did not agree")
	}

	if w := reserve(db, "alice", "room-rec", map[string]bool{"consentToRecording": true}); w.Code != http.StatusOK {
		t.Fatalf("with the consent: status %d (%s)", w.Code, w.Body.String())
	}
	var at struct{ N int64 }
	db.Raw("select count(*) as n from recording_consents where room_id = ? and user_id = ?", "room-rec", "alice").Scan(&at)
	if at.N != 1 {
		t.Fatalf("%d consent rows, want 1", at.N)
	}

	// asked once: reserving again (or after a cancel) does not ask again, and keeps a single row
	if w := reserve(db, "alice", "room-rec", nil); w.Code != http.StatusOK {
		t.Fatalf("second reservation: status %d (%s)", w.Code, w.Body.String())
	}
	db.Raw("select count(*) as n from recording_consents where room_id = ?", "room-rec").Scan(&at)
	if at.N != 1 {
		t.Fatalf("%d consent rows after a second reservation, want 1", at.N)
	}
}

func TestAReplayFreeLiveDoesNotAskForConsent(t *testing.T) {
	db := testDB(t)
	consentFixture(t, db, "room-norec", true)
	if w := reserve(db, "alice", "room-norec", nil); w.Code != http.StatusOK {
		t.Fatalf("status %d (%s), want 200 without any consent", w.Code, w.Body.String())
	}
	if ok, _ := liveModule.HasConsented(db, "room-norec", "alice"); ok {
		t.Error("nothing to consent to: no row expected")
	}
}

func TestJoiningARecordedLiveNeedsTheConsentToo(t *testing.T) {
	// a place reserved before consent existed must not slip through
	db := testDB(t)
	consentFixture(t, db, "room-old", false)
	if err := db.Model(&Room{}).Where("id = ?", "room-old").Update("participants", pq.StringArray{"host", "alice"}).Error; err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	peekLiveRoom("room-old").Participants = pq.StringArray{"host", "alice"}
	mu.Unlock()

	w := postOffer(webrtcRouter(db, "alice"), "/webrtc?roomId=room-old", realOffer(t))
	if w.Code != http.StatusForbidden || codeOf(w) != codeRecordingConsentRequired {
		t.Fatalf("status %d code %q, want 403 %s", w.Code, codeOf(w), codeRecordingConsentRequired)
	}
	// agreeing (re-reserving) unlocks it
	if w := reserve(db, "alice", "room-old", map[string]bool{"consentToRecording": true}); w.Code != http.StatusOK {
		t.Fatalf("reserve: %d %s", w.Code, w.Body.String())
	}
	if w := postOffer(webrtcRouter(db, "alice"), "/webrtc?roomId=room-old", realOffer(t)); w.Code != http.StatusOK {
		t.Fatalf("join after consent: %d %s", w.Code, w.Body.String())
	}
	// the host never needs it
	if w := postOffer(webrtcRouter(db, "host"), "/webrtc?roomId=room-old", realOffer(t)); w.Code != http.StatusOK {
		t.Fatalf("host: %d %s", w.Code, w.Body.String())
	}
}

func TestTheRoomViewSaysWhetherTheLiveIsRecorded(t *testing.T) {
	db := testDB(t)
	consentFixture(t, db, "room-view-rec", false)
	consentFixture(t, db, "room-view-norec", true)
	for id, want := range map[string]bool{"room-view-rec": true, "room-view-norec": false} {
		gin.SetMode(gin.TestMode)
		r := gin.New()
		r.GET("/rooms/:roomId", GetRoom(db))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/rooms/"+id, nil))
		var got struct {
			RecordReplay bool `json:"recordReplay"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil || got.RecordReplay != want {
			t.Errorf("%s: recordReplay = %v (%v), want %v: %s", id, got.RecordReplay, err, want, w.Body.String())
		}
	}
}

func TestEndingAReplayFreeLiveDeletesTheRecording(t *testing.T) {
	db := testDB(t)
	consentFixture(t, db, "room-end-norec", true)
	consentFixture(t, db, "room-end-rec", false)
	t.Chdir(t.TempDir())
	for _, id := range []string{"room-end-norec", "room-end-rec"} {
		if err := os.MkdirAll(filepath.Join("hls", id, "720p"), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join("hls", id, "720p", "segment_000.ts"), []byte("x"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	url, err := endHLS(db, "room-end-norec")
	if err != nil || url != "" {
		t.Fatalf("endHLS = %q, %v; a replay-free live must produce no replay", url, err)
	}
	if _, err := os.Stat(filepath.Join("hls", "room-end-norec")); !os.IsNotExist(err) {
		t.Error("the recording of a replay-free live must be deleted")
	}
	_ = hls.IsRunning // the recorded case needs a real FFmpeg run; covered by the hls tests
	if !liveModule.IsRecorded(db, "room-end-rec") || liveModule.IsRecorded(db, "room-end-norec") {
		t.Error("IsRecorded must follow the live's setting")
	}
}

func TestCreatingALiveCanDisableTheReplay(t *testing.T) {
	db := testDB(t)
	u := user.User{ID: "chef", Email: "chef@example.com", Password: "x", Username: "chef"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", "chef") })
	r.POST("/rooms", CreateNewRoom(db))

	for name, c := range map[string]struct {
		body     string
		disabled bool
	}{
		"absent": {`{"name":"Tarte","status":"scheduled","scheduledAt":"2031-01-01T10:00:00Z"}`, false},
		"true":   {`{"name":"Tarte","status":"scheduled","scheduledAt":"2031-01-01T10:00:00Z","recordReplay":true}`, false},
		"false":  {`{"name":"Tarte","status":"scheduled","scheduledAt":"2031-01-01T10:00:00Z","recordReplay":false}`, true},
	} {
		db.Exec("DELETE FROM lives")
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/rooms", bytes.NewBufferString(c.body))
		req.Header.Set("Content-Type", "application/json")
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("%s: status %d (%s)", name, w.Code, w.Body.String())
		}
		var l liveModule.Live
		if err := db.First(&l).Error; err != nil {
			t.Fatal(err)
		}
		if l.ReplayDisabled != c.disabled {
			t.Errorf("%s: ReplayDisabled = %v, want %v", name, l.ReplayDisabled, c.disabled)
		}
		removeLiveRoom(strings.TrimSpace(l.RoomID))
	}
}
