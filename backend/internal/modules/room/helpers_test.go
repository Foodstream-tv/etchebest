package room

import (
	"net/http"
	"slices"
	"testing"

	"github.com/lib/pq"
	"github.com/pion/webrtc/v4"
)

func TestWithoutCoStreamer(t *testing.T) {
	room := &Room{Host: "host", Participants: pq.StringArray{"host", "alice", "bob"}}

	kept, found := withoutCoStreamer(room, "alice")
	if !found || !slices.Equal(kept, pq.StringArray{"host", "bob"}) {
		t.Errorf("alice: kept %v found %v", kept, found)
	}
	if kept, found := withoutCoStreamer(room, "host"); found || len(kept) != 3 {
		t.Errorf("the host cannot cancel: kept %v found %v", kept, found)
	}
	if _, found := withoutCoStreamer(room, "nobody"); found {
		t.Error("someone who did not reserve has nothing to cancel")
	}
}

func TestFindKickTargetByUser(t *testing.T) {
	alicePC := newTestPC(t)
	room := &Room{Host: "host", Connections: []PeerConnection{{UserID: "alice", PeerCon: alicePC}}}

	if user, pc := findKickTarget(room, "", "alice"); user != "alice" || pc != alicePC {
		t.Errorf("connected user: got %q %v", user, pc)
	}
	if user, pc := findKickTarget(room, "", "bob"); user != "bob" || pc != nil {
		t.Errorf("user with a place but not connected: got %q %v", user, pc)
	}
	if user, pc := findKickTarget(room, "unknown-stream", ""); user != "" || pc != nil {
		t.Errorf("nobody to kick: got %q %v", user, pc)
	}
}

func TestCompleteRenegotiation(t *testing.T) {
	room := &Room{}
	if completeRenegotiation(room, "alice") {
		t.Error("a room without renegotiation state asks for nothing")
	}

	initRenegotiationMaps(room)
	room.PendingOfferByUser["alice"] = webrtc.SessionDescription{}
	room.RenegotiatingByUser["alice"] = true
	room.NeedsRenegotiationByUser["alice"] = true

	if !completeRenegotiation(room, "alice") {
		t.Error("a renegotiation asked for meanwhile must be reported")
	}
	_, pending := room.PendingOfferByUser["alice"]
	if pending || room.RenegotiatingByUser["alice"] || room.NeedsRenegotiationByUser["alice"] {
		t.Error("the user's renegotiation state must be cleared")
	}
	if completeRenegotiation(room, "alice") {
		t.Error("reported twice")
	}
}

func TestCheckReservable(t *testing.T) {
	const (
		openRoom  = "reserve-open"
		endedRoom = "reserve-ended"
	)
	db := testDB(t)
	createLive(t, db, openRoom, statusScheduled, nil)
	createLive(t, db, endedRoom, statusEnded, nil)

	if err := checkReservable(db, &Room{ID: openRoom, Host: "host"}, "host", true); err == nil || err.status != http.StatusBadRequest {
		t.Errorf("the host reserving their own live: %+v", err)
	}
	if err := checkReservable(db, &Room{ID: endedRoom, Host: "host"}, "alice", true); err == nil || err.status != http.StatusForbidden {
		t.Errorf("reserving an ended live: %+v", err)
	}
	if err := checkReservable(db, &Room{ID: openRoom, Host: "host"}, "alice", false); err == nil || err.body["code"] != codeRecordingConsentRequired {
		t.Errorf("a recorded live without consent: %+v", err)
	}
	if err := checkReservable(db, &Room{ID: openRoom, Host: "host"}, "alice", true); err != nil {
		t.Errorf("with consent: %+v", err)
	}
	if err := checkReservable(db, &Room{ID: openRoom, Host: "host"}, "alice", false); err != nil {
		t.Errorf("the consent is asked only once: %+v", err)
	}
}
