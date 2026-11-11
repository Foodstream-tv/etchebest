package room

import (
	"errors"
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
)

func TestEndingALiveDoesNotFreezeTheOtherLives(t *testing.T) {
	const endingRoom = "end-slow"
	db := testDB(t)
	t.Chdir(t.TempDir())
	room, hostPC, guestPC := runningRoom(t, db, endingRoom)
	// StopStream waits about 2 s before stopping FFmpeg: the ending takes at least that long.
	hls.RegisterToStream(endingRoom, func() {}, nil)

	mu.Lock()
	room.Connections = room.Connections[:1]
	mu.Unlock()
	_ = guestPC.Close()

	done := make(chan struct{})
	go func() {
		onPeerDisconnected(db, room, endingRoom, hostPC)
		close(done)
	}()
	waitUntil(t, "the room is detached", func() bool { return isClosing(endingRoom) })

	start := time.Now()
	mu.Lock()
	waited := time.Since(start)
	mu.Unlock()
	if waited > 500*time.Millisecond {
		t.Errorf("the other lives waited %s for the lock while a live was ending", waited)
	}
	if !isClosing(endingRoom) {
		t.Fatal("the test must take the lock while the live is still ending")
	}

	<-done
	if isClosing(endingRoom) || roomRowExists(t, db, endingRoom) {
		t.Error("once finished, the room is neither closing nor in the database")
	}
	if got := liveStatusOf(t, db, endingRoom).Status; got != statusEnded {
		t.Errorf("live = %s, want %s", got, statusEnded)
	}
}

func TestARoomBeingEndedIsNotLoadedAgainFromTheDatabase(t *testing.T) {
	const closingRoom = "end-closing"
	db := testDB(t)
	t.Chdir(t.TempDir())
	createLive(t, db, closingRoom, statusLive, nil)
	createRoomRow(t, db, closingRoom)

	mu.Lock()
	detachRoom(nil, closingRoom)
	mu.Unlock()

	if _, err := getLiveRoom(db, closingRoom); !errors.Is(err, errRoomClosing) {
		t.Fatalf("getLiveRoom = %v, want errRoomClosing: its DB record is still there until the end", err)
	}
	finishRoom(db, closingRoom, "test", nil)
	if isClosing(closingRoom) || peekLiveRoom(closingRoom) != nil || roomRowExists(t, db, closingRoom) {
		t.Error("a finished room must be gone everywhere")
	}
}

func TestAClosedRoomDoesNotStartHLS(t *testing.T) {
	r := &recorder{}
	h := h264State(r)
	h.src = hls.SourceSize{Width: 1280, Height: 720}
	room := &Room{ID: "end-no-hls", Host: "host", closed: true}

	mu.Lock()
	h.tryStartHLS(room, room.ID)
	mu.Unlock()

	if len(r.seen()) != 0 {
		t.Error("a track arriving after the end must not start FFmpeg: nothing would ever stop it")
	}
}

func TestTheStaleScheduledSweepSkipsARoomAlreadyEnding(t *testing.T) {
	const endingRoom = "end-stale-closing"
	db := testDB(t)
	long := time.Now().Add(-staleScheduledAfter - time.Hour)
	createLive(t, db, endingRoom, statusScheduled, &long)

	mu.Lock()
	detachRoom(nil, endingRoom)
	mu.Unlock()
	t.Cleanup(func() { finishRoom(db, endingRoom, "test", nil) })

	if ended := EndStaleScheduledLives(db, time.Now()); len(ended) != 0 {
		t.Errorf("ended %v: a room already ending must be left to the code finishing it", ended)
	}
}
