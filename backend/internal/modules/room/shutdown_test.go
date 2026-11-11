package room

import (
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
	"github.com/pion/webrtc/v4"
)

func TestStoppingTheServerEndsTheRunningLivesOnly(t *testing.T) {
	const (
		activeRoom    = "stop-running"
		recordingRoom = "stop-recording"
		scheduledRoom = "stop-scheduled"
	)
	db := testDB(t)
	t.Chdir(t.TempDir())

	_, _, guestPC := runningRoom(t, db, activeRoom)

	// Nobody connected any more, but its pipeline still records: it is running too.
	createLive(t, db, recordingRoom, statusLive, nil)
	createRoomRow(t, db, recordingRoom)
	setLiveRoom(recordingRoom, &Room{ID: recordingRoom, Host: "host"})
	hls.RegisterToStream(recordingRoom, func() {}, nil)

	// Scheduled, loaded in memory, nobody there yet: still scheduled after the restart.
	later := time.Now().Add(time.Hour)
	createLive(t, db, scheduledRoom, statusScheduled, &later)
	createRoomRow(t, db, scheduledRoom)
	setLiveRoom(scheduledRoom, &Room{ID: scheduledRoom, Host: "host"})
	t.Cleanup(func() { removeLiveRoom(scheduledRoom) })

	if n := EndRunningLives(db); n != 2 {
		t.Errorf("ended %d lives, want the 2 running ones", n)
	}
	for _, id := range []string{activeRoom, recordingRoom} {
		if got := liveStatusOf(t, db, id).Status; got != statusEnded {
			t.Errorf("%s is %s, want %s", id, got, statusEnded)
		}
		if peekLiveRoom(id) != nil || isClosing(id) || roomRowExists(t, db, id) {
			t.Errorf("%s must be gone from memory and from the database", id)
		}
	}
	if hls.IsRunning(recordingRoom) {
		t.Error("the pipeline of an ended live must be stopped")
	}
	if guestPC.ConnectionState() != webrtc.PeerConnectionStateClosed {
		t.Error("the peers of an ended live must be closed")
	}
	if liveStatusOf(t, db, scheduledRoom).Status != statusScheduled || !roomRowExists(t, db, scheduledRoom) {
		t.Error("a scheduled live nobody joined must be left alone")
	}
}
