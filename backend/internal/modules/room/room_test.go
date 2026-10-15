package room

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/pion/webrtc/v4"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRoomCapacityLimit(t *testing.T) {
	room := &Room{
		ID:              "test-room-id",
		Name:            "Test Live Cooking Room",
		Host:            "host-user-id",
		Participants:    pq.StringArray{"host-user-id"},
		Viewers:         0,
		MaxParticipants: 5,
	}

	if room.MaxParticipants != 5 {
		t.Fatalf("expected MaxParticipants to be 5, got %d", room.MaxParticipants)
	}

	// Add 4 more participants to reach maximum of 5
	for i := 1; i <= 4; i++ {
		userID := fmt.Sprintf("participant-%d", i)
		if len(room.Participants) >= room.MaxParticipants {
			t.Fatalf("should not be full yet at %d participants", len(room.Participants))
		}
		room.Participants = append(room.Participants, userID)
	}

	if len(room.Participants) != 5 {
		t.Fatalf("expected 5 participants, got %d", len(room.Participants))
	}

	// Now try to add a 6th participant
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	if len(room.Participants) >= room.MaxParticipants {
		c.JSON(http.StatusForbidden, gin.H{"error": "room is full"})
	}

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden for 6th participant, got %d", w.Code)
	}
}

func TestH264IsCompatible(t *testing.T) {
	srcFmtp := "packetization-mode=1;profile-level-id=42e01f;level-asymmetry-allowed=1"
	dstFmtp := "profile-level-id=42e01f;packetization-mode=1"

	if !h264IsCompatible(srcFmtp, dstFmtp) {
		t.Fatal("expected H264 fmtp to be compatible with same packetization-mode and profile-level-id")
	}

	incompatibleFmtp := "packetization-mode=0;profile-level-id=42e01f"
	if h264IsCompatible(srcFmtp, incompatibleFmtp) {
		t.Fatal("expected H264 fmtp with different packetization-mode to be incompatible")
	}

	incompatibleProfile := "packetization-mode=1;profile-level-id=64001f"
	if h264IsCompatible(srcFmtp, incompatibleProfile) {
		t.Fatal("expected H264 fmtp with different profile-level-id to be incompatible")
	}
}

func TestNormalizeFmtp(t *testing.T) {
	fmtp1 := "profile-level-id=42e01f; packetization-mode=1"
	fmtp2 := "packetization-mode=1;profile-level-id=42e01f"

	norm1 := normalizeFmtp(fmtp1)
	norm2 := normalizeFmtp(fmtp2)

	if norm1 != norm2 {
		t.Fatalf("expected normalized fmtp strings to match: %q vs %q", norm1, norm2)
	}
}

func TestShouldSendGatePLIIsTimeBased(t *testing.T) {
	var s hlsVideoState
	start := time.Now()

	if !s.shouldSendGatePLI(start) {
		t.Fatal("the first PLI must be sent immediately")
	}
	s.pliSentCount++
	// packets arriving at arbitrary instants (never on an exact multiple of 150 ms) must not starve it
	if s.shouldSendGatePLI(start.Add(40 * time.Millisecond)) {
		t.Fatal("PLI must be rate limited to one per interval")
	}
	if !s.shouldSendGatePLI(start.Add(151 * time.Millisecond)) {
		t.Fatal("a PLI is due once the interval elapsed, whatever the packet arrival time")
	}
}

func TestShouldSendGatePLIIsCapped(t *testing.T) {
	var s hlsVideoState
	s.pliSentCount = 15
	if s.shouldSendGatePLI(time.Now()) {
		t.Fatal("no more PLI after the cap")
	}
}

func TestUnregisterWSConnectionKeepsTheNewerRegistration(t *testing.T) {
	oldClient := &WSClientConn{roomID: "r", userID: "u", done: make(chan struct{})}
	newClient := &WSClientConn{roomID: "r", userID: "u", done: make(chan struct{})}

	wsConnMu.Lock()
	wsConnections = map[string]map[string]*WSClientConn{"r": {"u": newClient}}
	wsConnMu.Unlock()

	// The replaced connection finishes its cleanup after the newer one registered.
	unregisterWSConnection(oldClient)

	wsConnMu.RLock()
	got := wsConnections["r"]["u"]
	wsConnMu.RUnlock()
	if got != newClient {
		t.Fatal("cleanup of an old connection must not remove the new registration")
	}

	unregisterWSConnection(newClient)
	wsConnMu.RLock()
	_, stillThere := wsConnections["r"]
	wsConnMu.RUnlock()
	if stillThere {
		t.Fatal("removing the current connection should clear the room entry")
	}
}

func TestLiveRoomsRegistryIsSafeForConcurrentUse(t *testing.T) {
	const roomID = "concurrent-room"
	t.Cleanup(func() { removeLiveRoom(roomID) })

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			setLiveRoom(roomID, &Room{ID: roomID})
			_ = peekLiveRoom(roomID)
			removeLiveRoom(roomID)
		}()
	}
	wg.Wait()
}

func TestShouldTearDownOnConnectionState(t *testing.T) {
	cases := map[webrtc.PeerConnectionState]bool{
		webrtc.PeerConnectionStateNew:          false,
		webrtc.PeerConnectionStateConnecting:   false,
		webrtc.PeerConnectionStateConnected:    false,
		webrtc.PeerConnectionStateDisconnected: false, // recoverable: a Wi-Fi -> 4G switch must not end the live
		webrtc.PeerConnectionStateFailed:       true,
		webrtc.PeerConnectionStateClosed:       true,
	}
	for state, want := range cases {
		if got := shouldTearDownOnConnectionState(state); got != want {
			t.Errorf("state %s: tear down = %v, want %v", state, got, want)
		}
	}
}

func TestICEFailedTimeout(t *testing.T) {
	t.Setenv("WEBRTC_FAILED_TIMEOUT_SECONDS", "")
	if got := iceFailedTimeout(); got != 25*time.Second {
		t.Fatalf("default = %v, want 25s", got)
	}
	t.Setenv("WEBRTC_FAILED_TIMEOUT_SECONDS", "40")
	if got := iceFailedTimeout(); got != 40*time.Second {
		t.Fatalf("override = %v, want 40s", got)
	}
	for _, bad := range []string{"abc", "-3", "0", "2", "9999"} {
		t.Setenv("WEBRTC_FAILED_TIMEOUT_SECONDS", bad)
		if got := iceFailedTimeout(); got != 25*time.Second {
			t.Errorf("invalid value %q must fall back to the default, got %v", bad, got)
		}
	}
}

func newTestPC(t *testing.T) *webrtc.PeerConnection {
	t.Helper()
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	return pc
}

func TestRegisterPeerFirstConnectionReplacesNothing(t *testing.T) {
	room := &Room{ID: "r", Host: "host"}
	pc := newTestPC(t)

	_, replaced := registerPeer(pc, room, "host")

	if replaced != nil {
		t.Fatal("nothing to replace on a first connection")
	}
	if room.HostPeerCon != pc || len(room.Connections) != 1 {
		t.Fatalf("host peer not registered: host=%v connections=%d", room.HostPeerCon == pc, len(room.Connections))
	}
}

func TestRegisterPeerReplacesTheHostsStalePeer(t *testing.T) {
	room := &Room{
		ID: "r", Host: "host",
		PendingOfferByUser:       map[string]webrtc.SessionDescription{"host": {SDP: "stale"}, "guest": {SDP: "keep"}},
		RenegotiatingByUser:      map[string]bool{"host": true, "guest": true},
		NeedsRenegotiationByUser: map[string]bool{"host": true, "guest": true},
	}
	oldHost, guest, newHost := newTestPC(t), newTestPC(t), newTestPC(t)
	registerPeer(oldHost, room, "host")
	registerPeer(guest, room, "guest")
	room.Tracks = []*TrackInfo{{SourcePC: oldHost}, {SourcePC: guest}}

	_, replaced := registerPeer(newHost, room, "host")

	if replaced != oldHost {
		t.Fatal("the stale host peer must be returned so the caller closes it")
	}
	if room.HostPeerCon != newHost {
		t.Fatal("the new peer must become the host peer, otherwise it is never the HLS source again")
	}
	if len(room.Connections) != 2 {
		t.Fatalf("one connection per user: got %d", len(room.Connections))
	}
	for _, c := range room.Connections {
		if c.PeerCon == oldHost {
			t.Fatal("the stale peer must be gone from the connections")
		}
	}
	if len(room.Tracks) != 1 || room.Tracks[0].SourcePC != guest {
		t.Fatalf("only the stale peer's tracks are removed, got %d tracks", len(room.Tracks))
	}
	if _, ok := room.PendingOfferByUser["host"]; ok {
		t.Fatal("an offer built for the old peer cannot be applied to the new one")
	}
	if room.RenegotiatingByUser["host"] || room.NeedsRenegotiationByUser["host"] {
		t.Fatal("renegotiation flags of the replaced peer must be cleared")
	}
	if _, ok := room.PendingOfferByUser["guest"]; !ok || !room.RenegotiatingByUser["guest"] {
		t.Fatal("other users' renegotiation state must be untouched")
	}
}

func TestRegisterPeerKeepsParticipantsAndHostWhenAGuestReconnects(t *testing.T) {
	room := &Room{ID: "r", Host: "host", Participants: pq.StringArray{"host", "guest"}}
	host, oldGuest, newGuest := newTestPC(t), newTestPC(t), newTestPC(t)
	registerPeer(host, room, "host")
	registerPeer(oldGuest, room, "guest")

	_, replaced := registerPeer(newGuest, room, "guest")

	if replaced != oldGuest {
		t.Fatal("the guest's stale peer must be replaced")
	}
	if room.HostPeerCon != host {
		t.Fatal("a guest reconnecting must not touch the host peer")
	}
	if len(room.Participants) != 2 {
		t.Fatalf("the guest did not leave: its slot must be kept, got %v", room.Participants)
	}
}

func TestRegisterPeerSamePeerTwiceIsNotAReplacement(t *testing.T) {
	room := &Room{ID: "r", Host: "host"}
	pc := newTestPC(t)
	registerPeer(pc, room, "host")

	_, replaced := registerPeer(pc, room, "host")

	if replaced != nil {
		t.Fatal("registering the very same peer again must not report a replacement")
	}
}

func TestRegisterPeerStillReturnsBufferedICE(t *testing.T) {
	room := &Room{ID: "r", Host: "host", PendingICEByUser: map[string][]webrtc.ICECandidateInit{
		"host": {{Candidate: "candidate:1"}, {Candidate: "candidate:2"}},
	}}
	pending, _ := registerPeer(newTestPC(t), room, "host")

	if len(pending) != 2 || pending[0].Candidate != "candidate:1" {
		t.Fatalf("buffered ICE candidates lost: %v", pending)
	}
	if _, ok := room.PendingICEByUser["host"]; ok {
		t.Fatal("buffered candidates must be consumed")
	}
}
