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
	if err := db.Where(roomIDColumn+" = ?", roomID).First(&l).Error; err != nil {
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
	createLive(t, db, roomID, statusLive, nil)
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
	const hostGoneRoom = "room-host-gone"
	db := testDB(t)
	t.Chdir(t.TempDir())
	shortGrace(t, 100*time.Millisecond)
	room, hostPC, guestPC := runningRoom(t, db, hostGoneRoom)

	onPeerDisconnected(db, room, hostGoneRoom, hostPC)

	if peekLiveRoom(hostGoneRoom) != room || liveStatusOf(t, db, hostGoneRoom).Status != statusLive {
		t.Fatal("the live must go on during the grace: the host may come back")
	}
	waitUntil(t, "the live is ended", func() bool { return peekLiveRoom(hostGoneRoom) == nil })
	if got := liveStatusOf(t, db, hostGoneRoom); got.Status != statusEnded || got.EndedAt == nil {
		t.Errorf("live = %s (ended_at %v), want ended with an end time", got.Status, got.EndedAt)
	}
	if roomRowExists(t, db, hostGoneRoom) {
		t.Error("the room record must be deleted once the live is over")
	}
	waitUntil(t, "the co-streamer's peer is closed", func() bool {
		return guestPC.ConnectionState() == webrtc.PeerConnectionStateClosed
	})
}

func TestAHostBackInTimeKeepsTheLiveGoing(t *testing.T) {
	const hostBackRoom = "room-host-back"
	db := testDB(t)
	t.Chdir(t.TempDir())
	shortGrace(t, 100*time.Millisecond)
	room, hostPC, _ := runningRoom(t, db, hostBackRoom)

	onPeerDisconnected(db, room, hostBackRoom, hostPC)
	mu.Lock()
	registerPeer(newTestPC(t), room, "host")
	mu.Unlock()

	time.Sleep(300 * time.Millisecond)
	if peekLiveRoom(hostBackRoom) != room || liveStatusOf(t, db, hostBackRoom).Status != statusLive {
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
	const guestGoneRoom = "room-guest-gone"
	db := testDB(t)
	t.Chdir(t.TempDir())
	shortGrace(t, 50*time.Millisecond)
	room, _, guestPC := runningRoom(t, db, guestGoneRoom)

	onPeerDisconnected(db, room, guestGoneRoom, guestPC)

	time.Sleep(200 * time.Millisecond)
	if peekLiveRoom(guestGoneRoom) != room || liveStatusOf(t, db, guestGoneRoom).Status != statusLive {
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
	const (
		emptyRoom     = "boot-empty"
		noReplayRoom  = "boot-no-replay"
		orphanRoom    = "boot-orphan"
		recordedRoom  = "boot-recorded"
		scheduledRoom = "boot-scheduled"
	)
	db := testDB(t)
	t.Chdir(t.TempDir())

	createLive(t, db, recordedRoom, statusLive, nil)
	createRoomRow(t, db, recordedRoom)
	writeFile(t, "hls/boot-recorded/master.m3u8", "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n720p/index.m3u8\n")
	writeFile(t, "hls/boot-recorded/720p/index.m3u8", "#EXTM3U\n#EXTINF:2.0,\nsegment_000.ts\n")
	writeFile(t, "hls/boot-recorded/720p/segment_000.ts", "x")
	writeFile(t, "hls-work/boot-recorded/input.sdp", "v=0")

	createLive(t, db, noReplayRoom, statusLive, nil)
	createRoomRow(t, db, noReplayRoom)
	if err := db.Model(&liveModule.Live{}).Where(roomIDColumn+" = ?", noReplayRoom).Update("replay_disabled", true).Error; err != nil {
		t.Fatal(err)
	}
	writeFile(t, "hls/boot-no-replay/master.m3u8", "#EXTM3U\n")

	createLive(t, db, emptyRoom, statusLive, nil)
	createRoomRow(t, db, emptyRoom)

	soon := time.Now().Add(time.Hour)
	createLive(t, db, scheduledRoom, statusScheduled, &soon)
	createRoomRow(t, db, scheduledRoom)
	createRoomRow(t, db, orphanRoom)

	ReconcileOnBoot(db)

	assertReplayRebuilt(t, db, recordedRoom)
	assertPathsGone(t, "hls/boot-recorded", "hls-work/boot-recorded", "hls/boot-no-replay")
	assertEndedWithoutReplay(t, db, noReplayRoom)
	assertEndedWithoutReplay(t, db, emptyRoom)
	if liveStatusOf(t, db, scheduledRoom).Status != statusScheduled || !roomRowExists(t, db, scheduledRoom) {
		t.Error("a scheduled live and its room must be left alone")
	}
	for _, id := range []string{recordedRoom, noReplayRoom, emptyRoom, orphanRoom} {
		if roomRowExists(t, db, id) {
			t.Errorf("room %s must be deleted: no live will ever use it", id)
		}
	}
}

func assertReplayRebuilt(t *testing.T, db *gorm.DB, roomID string) {
	t.Helper()
	l := liveStatusOf(t, db, roomID)
	if l.Status != statusEnded || !l.HasReplay || l.ReplayURL != "/replays-storage/"+roomID+"/master.m3u8" {
		t.Errorf("live %s = %s, replay %v %q: want ended with its replay", roomID, l.Status, l.HasReplay, l.ReplayURL)
	}
	media, err := os.ReadFile(filepath.Join("storage/replays", roomID, "720p/index.m3u8"))
	if err != nil {
		t.Fatalf("the replay must be built from the recording: %v", err)
	}
	if !strings.Contains(string(media), "#EXT-X-ENDLIST") {
		t.Error("the replay playlist must be closed (#EXT-X-ENDLIST), or players keep waiting for more")
	}
}

func assertEndedWithoutReplay(t *testing.T, db *gorm.DB, roomID string) {
	t.Helper()
	if l := liveStatusOf(t, db, roomID); l.Status != statusEnded || l.HasReplay {
		t.Errorf("live %s = %s, replay %v: want ended without replay", roomID, l.Status, l.HasReplay)
	}
}

func assertPathsGone(t *testing.T, paths ...string) {
	t.Helper()
	for _, p := range paths {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Errorf("%s must be deleted (err %v)", p, err)
		}
	}
}

func TestStaleScheduledLivesAreEndedSoTheirHostCanScheduleAgain(t *testing.T) {
	const (
		connectedRoom = "sched-connected"
		futureRoom    = "sched-future"
		inMemoryRoom  = "sched-in-memory"
		lateRoom      = "sched-late"
		noTimeRoom    = "sched-no-time"
		staleRoom     = "sched-stale"
	)
	db := testDB(t)
	now := time.Now()
	long := now.Add(-staleScheduledAfter - time.Hour)
	recent := now.Add(-time.Hour)
	future := now.Add(24 * time.Hour)

	createLive(t, db, staleRoom, statusScheduled, &long)
	createRoomRow(t, db, staleRoom)
	createLive(t, db, lateRoom, statusScheduled, &recent)
	createLive(t, db, futureRoom, statusScheduled, &future)
	createLive(t, db, noTimeRoom, statusScheduled, nil)
	if err := db.Model(&liveModule.Live{}).Where(roomIDColumn+" = ?", noTimeRoom).Update("created_at", long).Error; err != nil {
		t.Fatal(err)
	}

	createLive(t, db, connectedRoom, statusScheduled, &long)
	connected := &Room{ID: connectedRoom, Host: "host", Connections: []PeerConnection{{UserID: "host", PeerCon: newTestPC(t)}}}
	setLiveRoom(connectedRoom, connected)
	t.Cleanup(func() { removeLiveRoom(connectedRoom) })

	createLive(t, db, inMemoryRoom, statusScheduled, &long)
	setLiveRoom(inMemoryRoom, &Room{ID: inMemoryRoom, Host: "host"})
	t.Cleanup(func() { removeLiveRoom(inMemoryRoom) })

	ended := EndStaleScheduledLives(db, now)

	want := map[string]string{
		staleRoom: statusEnded, noTimeRoom: statusEnded, inMemoryRoom: statusEnded,
		lateRoom: statusScheduled, futureRoom: statusScheduled, connectedRoom: statusScheduled,
	}
	for id, status := range want {
		if got := liveStatusOf(t, db, id).Status; got != status {
			t.Errorf("%s = %s, want %s", id, got, status)
		}
	}
	if len(ended) != 3 {
		t.Errorf("ended %v, want the 3 abandoned lives", ended)
	}
	if roomRowExists(t, db, staleRoom) {
		t.Error("the room of an abandoned live must be deleted")
	}
	if peekLiveRoom(inMemoryRoom) != nil {
		t.Error("an abandoned live must be forgotten in memory too")
	}
}

const (
	statusLive      = "live"
	statusScheduled = "scheduled"
	statusEnded     = "ended"
)
