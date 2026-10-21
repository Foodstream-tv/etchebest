package room

import (
	"bytes"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	liveModule "github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/pion/webrtc/v4"
	"gorm.io/gorm"
)

// realOffer builds a genuine SDP offer with a pion client (audio + video receivers, like a viewer).
func realOffer(t *testing.T) webrtc.SessionDescription {
	t.Helper()
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	for _, kind := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeAudio, webrtc.RTPCodecTypeVideo} {
		if _, err := pc.AddTransceiverFromKind(kind, webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
			t.Fatal(err)
		}
	}
	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	return offer
}

func TestValidateOffer(t *testing.T) {
	good := realOffer(t)
	if err := validateOffer(good); err != nil {
		t.Fatalf("a real offer must be valid: %v", err)
	}

	bad := map[string]webrtc.SessionDescription{
		"an answer":        {Type: webrtc.SDPTypeAnswer, SDP: good.SDP},
		"empty":            {Type: webrtc.SDPTypeOffer},
		"not an sdp":       {Type: webrtc.SDPTypeOffer, SDP: "hello world"},
		"no media section": {Type: webrtc.SDPTypeOffer, SDP: "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n"},
		"too large":        {Type: webrtc.SDPTypeOffer, SDP: good.SDP + strings.Repeat("a=x\r\n", maxSDPBytes/4)},
	}
	for name, offer := range bad {
		if err := validateOffer(offer); err == nil {
			t.Errorf("%s: must be refused", name)
		}
	}
}

func postOffer(r *gin.Engine, url string, body any) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, url, bytes.NewReader(raw)))
	return w
}

func webrtcRouter(db *gorm.DB, userID string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", userID) })
	r.POST("/webrtc", HandleWebRTC(db, "stun:stun.l.google.com:19302", "127.0.0.1"))
	r.POST("/rooms/:roomId/reserve", ReserveRoom(db))
	return r
}

// joinFixture stores a scheduled live in its room and tracks it in memory like the server does.
func joinFixture(t *testing.T, db *gorm.DB, roomID string, participants ...string) *Room {
	t.Helper()
	room := Room{ID: roomID, Name: "Tarte", Host: "host", Participants: append(pq.StringArray{"host"}, participants...), MaxParticipants: 5}
	if err := db.Create(&room).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&liveModule.Live{RoomID: roomID, Title: "Tarte", UserID: "host", Status: "scheduled"}).Error; err != nil {
		t.Fatal(err)
	}
	// the co-streamers already agreed to the recording (the join tests are not about consent)
	for _, p := range participants {
		if err := liveModule.RecordConsent(db, roomID, p, time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	live := room
	live.Connections = nil
	setLiveRoom(roomID, &live)
	t.Cleanup(func() {
		mu.Lock()
		for _, c := range live.Connections {
			if c.PeerCon != nil {
				_ = c.PeerCon.Close()
			}
		}
		mu.Unlock()
		removeLiveRoom(roomID)
	})
	return &live
}

func TestJoinNeedsAReservation(t *testing.T) {
	db := testDB(t)
	room := joinFixture(t, db, "room-auth", "bob")
	offer := realOffer(t)

	// someone who never reserved: refused, and nothing was taken
	w := postOffer(webrtcRouter(db, "mallory"), "/webrtc?roomId=room-auth", offer)
	if w.Code != http.StatusForbidden {
		t.Fatalf("unreserved user: status %d, want 403 (%s)", w.Code, w.Body.String())
	}
	mu.Lock()
	taken, conns := len(room.Participants), len(room.Connections)
	mu.Unlock()
	if taken != 2 || conns != 0 {
		t.Fatalf("a refused join must change nothing: %d participants, %d connections", taken, conns)
	}

	// a kicked user: refused even though reserved
	mu.Lock()
	room.KickedUsers = map[string]bool{"bob": true}
	mu.Unlock()
	if w := postOffer(webrtcRouter(db, "bob"), "/webrtc?roomId=room-auth", offer); w.Code != http.StatusForbidden {
		t.Fatalf("kicked user: status %d, want 403", w.Code)
	}
	mu.Lock()
	room.KickedUsers = nil
	mu.Unlock()

	// the reserved user and the host get in
	for _, u := range []string{"bob", "host"} {
		if w := postOffer(webrtcRouter(db, u), "/webrtc?roomId=room-auth", offer); w.Code != http.StatusOK {
			t.Fatalf("%s: status %d, want 200 (%s)", u, w.Code, w.Body.String())
		}
	}
}

func TestJoinRefusedOnceTheLiveIsOver(t *testing.T) {
	db := testDB(t)
	joinFixture(t, db, "room-over", "bob")
	if err := db.Model(&liveModule.Live{}).Where("room_id = ?", "room-over").Update("status", "ended").Error; err != nil {
		t.Fatal(err)
	}
	if w := postOffer(webrtcRouter(db, "bob"), "/webrtc?roomId=room-over", realOffer(t)); w.Code != http.StatusForbidden {
		t.Fatalf("status %d, want 403 for an ended live", w.Code)
	}
	if w := postOffer(webrtcRouter(db, "carol"), "/rooms/room-over/reserve", map[string]bool{"consentToRecording": true}); w.Code != http.StatusForbidden {
		t.Fatalf("reserving an ended live: status %d, want 403", w.Code)
	}
}

func TestABadOfferChangesNothing(t *testing.T) {
	db := testDB(t)
	room := joinFixture(t, db, "room-bad")
	r := webrtcRouter(db, "host")

	for name, body := range map[string]any{
		"garbage":    map[string]string{"type": "offer", "sdp": "nope"},
		"wrong type": map[string]string{"type": "answer", "sdp": realOffer(t).SDP},
		"not json":   "just a string",
		"empty":      map[string]string{},
		"huge":       map[string]string{"type": "offer", "sdp": strings.Repeat("x", maxSDPBytes*2)},
	} {
		w := postOffer(r, "/webrtc?roomId=room-bad", body)
		if w.Code < 400 || w.Code >= 500 {
			t.Errorf("%s: status %d, want a 4xx", name, w.Code)
		}
	}

	var status string
	db.Model(&liveModule.Live{}).Where("room_id = ?", "room-bad").Select("status").Scan(&status)
	mu.Lock()
	conns := len(room.Connections)
	mu.Unlock()
	if status != "scheduled" || conns != 0 {
		t.Fatalf("bad offers must not start the live or leave a peer: status %q, %d connections", status, conns)
	}
}

func TestAGoodOfferStartsTheLiveAndAReplayReplacesThePeer(t *testing.T) {
	db := testDB(t)
	room := joinFixture(t, db, "room-ok")
	r := webrtcRouter(db, "host")

	for i := 1; i <= 2; i++ {
		w := postOffer(r, "/webrtc?roomId=room-ok", realOffer(t))
		if w.Code != http.StatusOK {
			t.Fatalf("offer %d: status %d (%s)", i, w.Code, w.Body.String())
		}
		var answer struct {
			SDP string `json:"sdp"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &answer); err != nil || !strings.HasPrefix(answer.SDP, "v=0") {
			t.Fatalf("offer %d: no SDP answer: %s", i, w.Body.String())
		}
		mu.Lock()
		n := len(room.Connections)
		mu.Unlock()
		if n != 1 {
			t.Fatalf("after offer %d the user must have exactly one peer, got %d", i, n)
		}
	}

	var status string
	db.Model(&liveModule.Live{}).Where("room_id = ?", "room-ok").Select("status").Scan(&status)
	if status != "live" {
		t.Fatalf("the host's live must be running, status %q", status)
	}
}

func TestOnlyOneOfTwoSimultaneousReservationsGetsTheLastPlace(t *testing.T) {
	db := testDB(t)
	for _, id := range []string{"a", "b", "c", "d", "late1", "late2", "late3", "late4", "late5", "late6"} {
		u := user.User{ID: id, Email: id + "@example.com", Password: "x", Username: id}
		if err := db.Create(&u).Error; err != nil {
			t.Fatal(err)
		}
	}
	room := joinFixture(t, db, "room-race", "a", "b", "c", "d") // host + 4: one place left

	var wg sync.WaitGroup
	codes := make(chan int, 6)
	for _, id := range []string{"late1", "late2", "late3", "late4", "late5", "late6"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			codes <- postOffer(webrtcRouter(db, id), "/rooms/room-race/reserve", map[string]bool{"consentToRecording": true}).Code
		}(id)
	}
	wg.Wait()
	close(codes)

	ok := 0
	for code := range codes {
		if code == http.StatusOK {
			ok++
		}
	}
	if ok != 1 {
		t.Fatalf("%d reservations succeeded for the last place, want exactly 1", ok)
	}
	stored, _ := GetRoomById(db, "room-race")
	if got := coStreamerCount(stored); got != 5 {
		t.Fatalf("%d co-streamers stored, want 5", got)
	}
	_ = room
}

func TestFiveReservedCoStreamersCanAllJoin(t *testing.T) {
	db := testDB(t)
	room := joinFixture(t, db, "room-full", "a", "b", "c", "d", "e")
	for _, u := range []string{"a", "b", "c", "d", "e", "host"} {
		if w := postOffer(webrtcRouter(db, u), "/webrtc?roomId=room-full", realOffer(t)); w.Code != http.StatusOK {
			t.Fatalf("%s: status %d (%s)", u, w.Code, w.Body.String())
		}
	}
	mu.Lock()
	n := len(room.Connections)
	mu.Unlock()
	if n != 6 {
		t.Fatalf("%d peers, want host + 5", n)
	}
}

func TestPortConfigurationFailsFast(t *testing.T) {
	cases := map[string]map[string]string{
		"not a number":  {"WEBRTC_PORT_MIN": "abc"},
		"too big":       {"WEBRTC_PORT_MAX": "70000"},
		"min above max": {"WEBRTC_PORT_MIN": "50100", "WEBRTC_PORT_MAX": "50000"},
		"bad mux":       {"WEBRTC_UDP_MUX_PORT": "0"},
	}
	for name, env := range cases {
		for k, v := range env {
			t.Setenv(k, v)
		}
		if ValidateWebRTCConfig() == nil {
			t.Errorf("%s: the configuration must be refused", name)
		}
		for k := range env {
			t.Setenv(k, "")
		}
	}
	if err := ValidateWebRTCConfig(); err != nil {
		t.Errorf("defaults must be valid: %v", err)
	}
}

func TestPeersCanShareOneUDPPort(t *testing.T) {
	probe, err := net.ListenUDP("udp", &net.UDPAddr{})
	if err != nil {
		t.Skipf("no UDP available: %v", err)
	}
	port := probe.LocalAddr().(*net.UDPAddr).Port
	probe.Close()
	t.Setenv("WEBRTC_UDP_MUX_PORT", strconv.Itoa(port))

	db := testDB(t)
	joinFixture(t, db, "room-mux", "a", "b")
	for _, u := range []string{"host", "a", "b"} {
		w := postOffer(webrtcRouter(db, u), "/webrtc?roomId=room-mux", realOffer(t))
		if w.Code != http.StatusOK {
			t.Fatalf("%s over the shared port: status %d (%s)", u, w.Code, w.Body.String())
		}
		if !strings.Contains(w.Body.String(), strconv.Itoa(port)) {
			t.Fatalf("%s: the answer must advertise the shared port %d: %s", u, port, w.Body.String())
		}
	}
}
