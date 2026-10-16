package room

import (
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/pion/webrtc/v4"
)

func fakePC() *webrtc.PeerConnection { return &webrtc.PeerConnection{} }

func TestNewRoomViewShowsNamesNotIdsAndCountsConnectedCoStreamers(t *testing.T) {
	room := &Room{ID: "r", Host: "host-id", Participants: pq.StringArray{"host-id", "alice-id", "ghost-id"}}
	connected := map[string]bool{"host-id": true, "alice-id": true}
	names := map[string]string{"host-id": "chef", "alice-id": "alice"} // ghost-id has no known name

	view := newRoomView(room, connected, names)

	if view.ConnectedCount != 1 {
		t.Fatalf("connected co-streamers = %d, want 1 (the host is not a co-streamer, the ghost is not connected)", view.ConnectedCount)
	}
	want := []ParticipantInfo{
		{ID: "host-id", Username: "chef", Role: "host", Connected: true},
		{ID: "alice-id", Username: "alice", Role: "participant", Connected: true},
		{ID: "ghost-id", Username: "", Role: "participant", Connected: false},
	}
	if len(view.ParticipantsInfo) != len(want) {
		t.Fatalf("got %d participants, want %d", len(view.ParticipantsInfo), len(want))
	}
	for i, w := range want {
		if view.ParticipantsInfo[i] != w {
			t.Errorf("participant %d = %+v, want %+v", i, view.ParticipantsInfo[i], w)
		}
	}
	// the raw list is still there for older clients
	if len(view.Participants) != 3 {
		t.Errorf("participants must stay in the view for older clients, got %v", view.Participants)
	}
}

func TestNewRoomViewOfARoomNotLiveInMemoryHasNobodyConnected(t *testing.T) {
	room := &Room{ID: "r", Host: "h", Participants: pq.StringArray{"h", "a"}}
	view := newRoomView(room, connectedUsers(nil), map[string]string{"h": "chef", "a": "alice"})
	if view.ConnectedCount != 0 {
		t.Errorf("ConnectedCount = %d, want 0", view.ConnectedCount)
	}
	for _, p := range view.ParticipantsInfo {
		if p.Connected {
			t.Errorf("%s must not be connected", p.Username)
		}
	}
}

func TestConnectedUsersIgnoresEmptySlots(t *testing.T) {
	room := &Room{Connections: []PeerConnection{{UserID: "a", PeerCon: fakePC()}, {UserID: "b", PeerCon: nil}, {UserID: "", PeerCon: fakePC()}}}
	got := connectedUsers(room)
	if len(got) != 1 || !got["a"] {
		t.Errorf("connectedUsers = %v, want only a", got)
	}
}

func liveRoomWithHost(hostSince time.Time) *Room {
	host := fakePC()
	return &Room{
		ID:              "r",
		Host:            "host",
		Participants:    pq.StringArray{"host", "alice", "bob"},
		HostPeerCon:     host,
		HostConnectedAt: hostSince,
		Connections:     []PeerConnection{{UserID: "host", PeerCon: host}},
	}
}

func TestGhostParticipantsAreThoseWhoNeverConnectedAfterTheGrace(t *testing.T) {
	now := time.Now()
	room := liveRoomWithHost(now.Add(-10 * time.Minute))
	room.Connections = append(room.Connections, PeerConnection{UserID: "alice", PeerCon: fakePC()}) // really connected
	markPending(room, "bob", now.Add(-4*time.Minute))                                              // took a slot long ago, never connected

	ghosts := ghostParticipants(room, now, 3*time.Minute)
	if len(ghosts) != 1 || ghosts[0] != "bob" {
		t.Fatalf("ghosts = %v, want [bob]", ghosts)
	}
}

func TestAFreshJoinIsNotAGhostYet(t *testing.T) {
	now := time.Now()
	room := liveRoomWithHost(now.Add(-10 * time.Minute))
	markPending(room, "alice", now.Add(-20*time.Second)) // joining right now
	markPending(room, "bob", now.Add(-2*time.Minute))
	if ghosts := ghostParticipants(room, now, 3*time.Minute); len(ghosts) != 0 {
		t.Errorf("nobody is past the grace yet, got %v", ghosts)
	}
}

func TestReservationsOfAScheduledLiveGetTheGraceAfterItGoesLive(t *testing.T) {
	now := time.Now()
	// alice and bob reserved days ago, the host only went live 30 s ago
	room := liveRoomWithHost(now.Add(-30 * time.Second))
	markPending(room, "alice", now.Add(-72*time.Hour))
	markPending(room, "bob", now.Add(-72*time.Hour))
	if ghosts := ghostParticipants(room, now, 3*time.Minute); len(ghosts) != 0 {
		t.Errorf("reservations must survive the start of the live, got %v", ghosts)
	}
	// but the grace counts from the go-live: four minutes later, those who never came are freed
	if ghosts := ghostParticipants(room, now.Add(4*time.Minute), 3*time.Minute); len(ghosts) != 2 {
		t.Errorf("ghosts after the grace = %v, want alice and bob", ghosts)
	}
}

func TestNothingIsReapedWhileTheHostIsNotConnected(t *testing.T) {
	now := time.Now()
	room := &Room{ID: "r", Host: "host", Participants: pq.StringArray{"host", "alice"}}
	markPending(room, "alice", now.Add(-48*time.Hour))
	if ghosts := ghostParticipants(room, now, 3*time.Minute); ghosts != nil {
		t.Errorf("a scheduled live keeps its reservations, got %v", ghosts)
	}
}

func TestTheHostIsNeverAGhostAndAnUntimedParticipantStartsCounting(t *testing.T) {
	now := time.Now()
	room := liveRoomWithHost(time.Time{}) // no reference moment for the host either
	room.Connections = nil                // even if the host's connection record is gone
	room.Participants = pq.StringArray{"host", "alice"}

	if ghosts := ghostParticipants(room, now, time.Minute); len(ghosts) != 0 {
		t.Fatalf("no reference moment: start counting, do not reap blindly; got %v", ghosts)
	}
	if room.PendingSince["alice"].IsZero() {
		t.Error("the participant without a timestamp must get one")
	}
	if _, ok := room.PendingSince["host"]; ok {
		t.Error("the host is never tracked")
	}
	if ghosts := ghostParticipants(room, now.Add(2*time.Minute), time.Minute); len(ghosts) != 1 || ghosts[0] != "alice" {
		t.Errorf("after the grace alice is a ghost, got %v", ghosts)
	}
}

func TestMarkPendingIgnoresTheHostAndEmptyIds(t *testing.T) {
	room := &Room{Host: "host"}
	markPending(room, "host", time.Now())
	markPending(room, "", time.Now())
	markPending(nil, "x", time.Now()) // must not panic
	if len(room.PendingSince) != 0 {
		t.Errorf("nothing should be tracked, got %v", room.PendingSince)
	}
}

func TestRegisterPeerClearsThePendingMarkAndRecordsWhenTheHostWentLive(t *testing.T) {
	room := &Room{ID: "r", Host: "host", Participants: pq.StringArray{"host", "alice"}}
	markPending(room, "alice", time.Now().Add(-time.Hour))

	registerPeer(fakePC(), room, "alice")
	if _, ok := room.PendingSince["alice"]; ok {
		t.Error("a connected participant is no longer pending")
	}
	if !room.HostConnectedAt.IsZero() {
		t.Error("a guest connecting is not the live starting")
	}

	registerPeer(fakePC(), room, "host")
	if room.HostConnectedAt.IsZero() {
		t.Error("the host connecting must record when the live started")
	}
}
