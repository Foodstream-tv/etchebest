package room

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	liveModule "github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/lib/pq"
	"github.com/pion/webrtc/v4"
	"gorm.io/gorm"
)

func shortGrace(t *testing.T, d time.Duration) {
	t.Helper()
	prev := hostAbsentGrace
	hostAbsentGrace = d
	t.Cleanup(func() { hostAbsentGrace = prev })
}

func createLive(t *testing.T, db *gorm.DB, roomID, status string, scheduledAt *time.Time) {
	t.Helper()
	l := liveModule.Live{RoomID: roomID, Title: roomID, UserID: "host", Status: status, ScheduledAt: scheduledAt}
	if err := db.Create(&l).Error; err != nil {
		t.Fatal(err)
	}
}

func createRoomRow(t *testing.T, db *gorm.DB, roomID string) {
	t.Helper()
	r := Room{ID: roomID, Name: roomID, Host: "host", Participants: pq.StringArray{"host"}}
	if err := db.Create(&r).Error; err != nil {
		t.Fatal(err)
	}
}

func liveStatusOf(t *testing.T, db *gorm.DB, roomID string) liveModule.Live {
	t.Helper()
	var l liveModule.Live
	if err := db.Where("room_id = ?", roomID).First(&l).Error; err != nil {
		t.Fatal(err)
	}
	return l
}

func roomRowExists(t *testing.T, db *gorm.DB, roomID string) bool {
	t.Helper()
	var n int64
	if err := db.Model(&Room{}).Where("id = ?", roomID).Count(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n > 0
}

func runningRoom(t *testing.T, db *gorm.DB, roomID string) (room *Room, hostPC, guestPC *webrtc.PeerConnection) {
	t.Helper()
	createLive(t, db, roomID, "live", nil)
	createRoomRow(t, db, roomID)
	hostPC, guestPC = newTestPC(t), newTestPC(t)
	room = &Room{
		ID:           roomID,
		Host:         "host",
		Participants: pq.StringArray{"host", "guest"},
		Connections:  []PeerConnection{{UserID: "host", PeerCon: hostPC}, {UserID: "guest", PeerCon: guestPC}},
		HostPeerCon:  hostPC,
	}
	setLiveRoom(roomID, room)
	t.Cleanup(func() {
		mu.Lock()
		stopHostAbsentTimer(room)
		mu.Unlock()
		removeLiveRoom(roomID)
	})
	return room, hostPC, guestPC
}

func waitUntil(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting until %s", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestALiveWhoseHostDoesNotComeBackIsEndedAfterTheGrace(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())
	shortGrace(t, 100*time.Millisecond)
	room, hostPC, guestPC := runningRoom(t, db, "room-host-gone")

	onPeerDisconnected(db, room, "room-host-gone", hostPC)

	if peekLiveRoom("room-host-gone") != room || liveStatusOf(t, db, "room-host-gone").Status != "live" {
		t.Fatal("the live must go on during the grace: the host may come back")
	}
	waitUntil(t, "the live is ended", func() bool { return peekLiveRoom("room-host-gone") == nil })
	if got := liveStatusOf(t, db, "room-host-gone"); got.Status != "ended" || got.EndedAt == nil {
		t.Errorf("live = %s (ended_at %v), want ended with an end time", got.Status, got.EndedAt)
	}
	if roomRowExists(t, db, "room-host-gone") {
		t.Error("the room record must be deleted once the live is over")
	}
	waitUntil(t, "the co-streamer's peer is closed", func() bool {
		return guestPC.ConnectionState() == webrtc.PeerConnectionStateClosed
	})
}

func TestAHostBackInTimeKeepsTheLiveGoing(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())
	shortGrace(t, 100*time.Millisecond)
	room, hostPC, _ := runningRoom(t, db, "room-host-back")

	onPeerDisconnected(db, room, "room-host-back", hostPC)
	mu.Lock()
	registerPeer(newTestPC(t), room, "host")
	mu.Unlock()

	time.Sleep(300 * time.Millisecond)
	if peekLiveRoom("room-host-back") != room || liveStatusOf(t, db, "room-host-back").Status != "live" {
		t.Fatal("a host who reconnects within the grace must keep the live")
	}
	mu.Lock()
	armed := room.hostAbsentTimer != nil
	mu.Unlock()
	if armed {
		t.Error("the countdown must be cancelled when the host reconnects")
	}
}

func TestACoStreamerLeavingDoesNotEndTheLive(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())
	shortGrace(t, 50*time.Millisecond)
	room, _, guestPC := runningRoom(t, db, "room-guest-gone")

	onPeerDisconnected(db, room, "room-guest-gone", guestPC)

	time.Sleep(200 * time.Millisecond)
	if peekLiveRoom("room-guest-gone") != room || liveStatusOf(t, db, "room-guest-gone").Status != "live" {
		t.Fatal("a co-streamer leaving must not end the host's live")
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestBootEndsTheLivesThatWereRunningAndDeletesOrphanRooms(t *testing.T) {
	db := testDB(t)
	t.Chdir(t.TempDir())

	createLive(t, db, "boot-recorded", "live", nil)
	createRoomRow(t, db, "boot-recorded")
	writeFile(t, "hls/boot-recorded/master.m3u8", "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n720p/index.m3u8\n")
	writeFile(t, "hls/boot-recorded/720p/index.m3u8", "#EXTM3U\n#EXTINF:2.0,\nsegment_000.ts\n")
	writeFile(t, "hls/boot-recorded/720p/segment_000.ts", "x")
	writeFile(t, "hls-work/boot-recorded/input.sdp", "v=0")

	createLive(t, db, "boot-no-replay", "live", nil)
	createRoomRow(t, db, "boot-no-replay")
	if err := db.Model(&liveModule.Live{}).Where("room_id = ?", "boot-no-replay").Update("replay_disabled", true).Error; err != nil {
		t.Fatal(err)
	}
	writeFile(t, "hls/boot-no-replay/master.m3u8", "#EXTM3U\n")

	createLive(t, db, "boot-empty", "live", nil)
	createRoomRow(t, db, "boot-empty")

	soon := time.Now().Add(time.Hour)
	createLive(t, db, "boot-scheduled", "scheduled", &soon)
	createRoomRow(t, db, "boot-scheduled")
	createRoomRow(t, db, "boot-orphan")

	ReconcileOnBoot(db)

	rec := liveStatusOf(t, db, "boot-recorded")
	if rec.Status != "ended" || !rec.HasReplay || rec.ReplayURL != "/replays-storage/boot-recorded/master.m3u8" {
		t.Errorf("recorded live = %s, replay %v %q: want ended with its replay", rec.Status, rec.HasReplay, rec.ReplayURL)
	}
	media, err := os.ReadFile("storage/replays/boot-recorded/720p/index.m3u8")
	if err != nil {
		t.Fatalf("the replay must be built from the recording: %v", err)
	}
	if !strings.Contains(string(media), "#EXT-X-ENDLIST") {
		t.Error("the replay playlist must be closed (#EXT-X-ENDLIST), or players keep waiting for more")
	}
	for _, gone := range []string{"hls/boot-recorded", "hls-work/boot-recorded", "hls/boot-no-replay"} {
		if _, err := os.Stat(gone); !os.IsNotExist(err) {
			t.Errorf("%s must be deleted (err %v)", gone, err)
		}
	}
	if nr := liveStatusOf(t, db, "boot-no-replay"); nr.Status != "ended" || nr.HasReplay {
		t.Errorf("live without replay = %s, replay %v: want ended without replay", nr.Status, nr.HasReplay)
	}
	if empty := liveStatusOf(t, db, "boot-empty"); empty.Status != "ended" || empty.HasReplay {
		t.Errorf("empty live = %s, replay %v: want ended without replay", empty.Status, empty.HasReplay)
	}
	if liveStatusOf(t, db, "boot-scheduled").Status != "scheduled" || !roomRowExists(t, db, "boot-scheduled") {
		t.Error("a scheduled live and its room must be left alone")
	}
	for _, id := range []string{"boot-recorded", "boot-no-replay", "boot-empty", "boot-orphan"} {
		if roomRowExists(t, db, id) {
			t.Errorf("room %s must be deleted: no live will ever use it", id)
		}
	}
}

func TestStaleScheduledLivesAreEndedSoTheirHostCanScheduleAgain(t *testing.T) {
	db := testDB(t)
	now := time.Now()
	long := now.Add(-staleScheduledAfter - time.Hour)
	recent := now.Add(-time.Hour)
	future := now.Add(24 * time.Hour)

	createLive(t, db, "sched-stale", "scheduled", &long)
	createRoomRow(t, db, "sched-stale")
	createLive(t, db, "sched-late", "scheduled", &recent)
	createLive(t, db, "sched-future", "scheduled", &future)
	createLive(t, db, "sched-no-time", "scheduled", nil)
	if err := db.Model(&liveModule.Live{}).Where("room_id = ?", "sched-no-time").Update("created_at", long).Error; err != nil {
		t.Fatal(err)
	}

	createLive(t, db, "sched-connected", "scheduled", &long)
	connected := &Room{ID: "sched-connected", Host: "host", Connections: []PeerConnection{{UserID: "host", PeerCon: newTestPC(t)}}}
	setLiveRoom("sched-connected", connected)
	t.Cleanup(func() { removeLiveRoom("sched-connected") })

	createLive(t, db, "sched-in-memory", "scheduled", &long)
	setLiveRoom("sched-in-memory", &Room{ID: "sched-in-memory", Host: "host"})
	t.Cleanup(func() { removeLiveRoom("sched-in-memory") })

	ended := EndStaleScheduledLives(db, now)

	want := map[string]string{
		"sched-stale": "ended", "sched-no-time": "ended", "sched-in-memory": "ended",
		"sched-late": "scheduled", "sched-future": "scheduled", "sched-connected": "scheduled",
	}
	for id, status := range want {
		if got := liveStatusOf(t, db, id).Status; got != status {
			t.Errorf("%s = %s, want %s", id, got, status)
		}
	}
	if len(ended) != 3 {
		t.Errorf("ended %v, want the 3 abandoned lives", ended)
	}
	if roomRowExists(t, db, "sched-stale") {
		t.Error("the room of an abandoned live must be deleted")
	}
	if peekLiveRoom("sched-in-memory") != nil {
		t.Error("an abandoned live must be forgotten in memory too")
	}
}
