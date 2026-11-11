//go:build e2e

package e2e

import (
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"
)

const segmentsWait = 15 * time.Second // FFmpeg writes 2 s segments: a few are there by then

func TestRestartMidLiveEndsItWithItsReplay(t *testing.T) {
	host := login(t, hostEmail)
	endActiveLives(t, host)
	roomID := createLive(t, host, statusLive, nil)
	mustPublish(t, host, roomID)
	time.Sleep(segmentsWait)

	exitCode := restartBackend(t)
	t.Logf("backend stopped with exit code %q", exitCode)

	l := getLive(t, roomID)
	if l.Status != statusEnded || !l.HasReplay {
		t.Fatalf("after the restart: %+v, want ended with a replay", l)
	}
	if n := replaySegments(t, l.ReplayURL); n == 0 {
		t.Errorf("the rebuilt replay has no segment")
	} else {
		t.Logf("rebuilt replay: %d segments", n)
	}
	if code, data := call(t, http.MethodPost, "/api/rooms", host.token, map[string]any{"name": "e2e again", "status": "scheduled"}); code != http.StatusOK {
		t.Errorf("the host cannot create a live right after the restart: %d %s", code, data)
	}
	endActiveLives(t, host)
}

// coStreamerJoins reserves a place (with the recording consent) and publishes into the host's live.
func coStreamerJoins(t *testing.T, guest account, roomID string) *publisher {
	t.Helper()
	if code, data := call(t, http.MethodPost, "/api/rooms/"+roomID+"/reserve", guest.token, map[string]bool{"consentToRecording": true}); code != http.StatusOK {
		t.Fatalf("reserve: %d %s", code, data)
	}
	return mustPublish(t, guest, roomID)
}

func TestALiveWhoseHostIsGoneEndsAfterTheGrace(t *testing.T) {
	host, guest := login(t, hostEmail), login(t, viewerEmail)
	endActiveLives(t, host)
	endActiveLives(t, guest)
	roomID := createLive(t, host, statusLive, nil)
	hostPub := mustPublish(t, host, roomID)
	guestPub := coStreamerJoins(t, guest, roomID)
	time.Sleep(3 * time.Second)

	hostPub.close() // the host's app dies: no disconnect call
	time.Sleep(45 * time.Second)
	if s := getLive(t, roomID).Status; s != statusLive {
		t.Fatalf("45 s after the host left the live is %s: it must wait 60 s for the host", s)
	}
	took := 45*time.Second + waitForStatus(t, roomID, statusEnded, 40*time.Second)
	t.Logf("live ended %s after the host left", took.Round(time.Second))
	if s := guestPub.pc.ConnectionState(); s == webrtc.PeerConnectionStateConnected {
		t.Errorf("the co-streamer is still connected (%s) once the live ended", s)
	}
}

func TestAHostBackWithinTheGraceKeepsTheLive(t *testing.T) {
	host, guest := login(t, hostEmail), login(t, viewerEmail)
	endActiveLives(t, host)
	endActiveLives(t, guest)
	roomID := createLive(t, host, statusLive, nil)
	hostPub := mustPublish(t, host, roomID)
	coStreamerJoins(t, guest, roomID)
	time.Sleep(3 * time.Second)

	hostPub.close()
	time.Sleep(20 * time.Second)
	mustPublish(t, host, roomID) // the host's app comes back
	time.Sleep(55 * time.Second)
	if s := getLive(t, roomID).Status; s != statusLive {
		t.Fatalf("the host came back within the grace but the live is %s", s)
	}
	endActiveLives(t, host)
}

func TestAnAbandonedScheduledLiveIsEnded(t *testing.T) {
	host := login(t, hostEmail)
	endActiveLives(t, host)
	soon := time.Now().Add(time.Hour)
	roomID := createLive(t, host, "scheduled", &soon)
	psql(t, "update lives set scheduled_at = now() - interval '13 hours' where room_id = '"+roomID+"'")

	restartBackend(t) // the sweep runs at start
	if s := getLive(t, roomID).Status; s != statusEnded {
		t.Fatalf("a scheduled live 13 h late is %s, want ended", s)
	}
	if code, data := call(t, http.MethodPost, "/api/rooms", host.token, map[string]any{"name": "e2e next", "status": "scheduled"}); code != http.StatusOK {
		t.Errorf("the host cannot schedule again: %d %s", code, data)
	}
	endActiveLives(t, host)
}

func TestEndingALiveDoesNotFreezeAnother(t *testing.T) {
	hostA, hostB := login(t, hostEmail), login(t, viewerEmail)
	endActiveLives(t, hostA)
	endActiveLives(t, hostB)
	roomA := createLive(t, hostA, statusLive, nil)
	roomB := createLive(t, hostB, statusLive, nil)
	mustPublish(t, hostA, roomA)
	mustPublish(t, hostB, roomB)
	time.Sleep(segmentsWait)

	stop := make(chan struct{})
	var worst time.Duration
	var wg sync.WaitGroup
	wg.Go(func() { // a viewer of B keeps asking for its room (the handler takes the live lock)
		for {
			select {
			case <-stop:
				return
			default:
			}
			start := time.Now()
			call(t, http.MethodGet, "/api/rooms/"+roomB, hostB.token, nil)
			worst = max(worst, time.Since(start))
			time.Sleep(50 * time.Millisecond)
		}
	})
	start := time.Now()
	call(t, http.MethodPost, "/api/rooms/"+roomA+"/disconnect", hostA.token, nil)
	ending := time.Since(start)
	close(stop)
	wg.Wait()

	t.Logf("ending A took %s; slowest request on B meanwhile: %s", ending.Round(time.Millisecond), worst.Round(time.Millisecond))
	if worst > 500*time.Millisecond {
		t.Errorf("a request on B waited %s while A was ending", worst)
	}
	if l := getLive(t, roomA); l.Status != statusEnded || !l.HasReplay {
		t.Errorf("A after its end: %+v, want ended with a replay", l)
	}
	if s := getLive(t, roomB).Status; s != statusLive {
		t.Errorf("B is %s, want still live", s)
	}
	endActiveLives(t, hostB)
}

func TestReservationConsentCancelAndKick(t *testing.T) {
	host, guest := login(t, hostEmail), login(t, viewerEmail)
	endActiveLives(t, host)
	endActiveLives(t, guest)
	roomID := createLive(t, host, statusLive, nil)
	mustPublish(t, host, roomID)
	reserve := "/api/rooms/" + roomID + "/reserve"

	steps := []struct {
		name   string
		method string
		body   any
		want   int
	}{
		{"without consent", http.MethodPost, map[string]bool{"consentToRecording": false}, http.StatusBadRequest},
		{"with consent", http.MethodPost, map[string]bool{"consentToRecording": true}, http.StatusOK},
		{"twice", http.MethodPost, nil, http.StatusOK},
		{"cancel", http.MethodDelete, nil, http.StatusOK},
		{"cancel again", http.MethodDelete, nil, http.StatusBadRequest},
		{"again, consent kept", http.MethodPost, nil, http.StatusOK},
	}
	for _, s := range steps {
		if code, data := call(t, s.method, reserve, guest.token, s.body); code != s.want {
			t.Errorf("%s: %d %s, want %d", s.name, code, data, s.want)
		}
	}
	if code, _ := call(t, http.MethodPost, reserve, host.token, nil); code != http.StatusBadRequest {
		t.Errorf("the host reserving their own live: %d, want 400", code)
	}

	guestPub := mustPublish(t, guest, roomID)
	if code, data := call(t, http.MethodPost, "/api/rooms/"+roomID+"/kick", host.token, map[string]string{"userId": guest.id}); code != http.StatusOK {
		t.Fatalf("kick: %d %s", code, data)
	}
	time.Sleep(2 * time.Second)
	if s := guestPub.pc.ConnectionState(); s == webrtc.PeerConnectionStateConnected {
		t.Errorf("the kicked co-streamer is still connected")
	}
	var refused errRefused
	if _, err := publish(t, guest, roomID); !errors.As(err, &refused) || refused.status != http.StatusForbidden {
		t.Errorf("a kicked co-streamer joining again: %v, want 403", err)
	}
	endActiveLives(t, host)
}

func TestAVeryShortLiveHasNoEmptyReplay(t *testing.T) {
	host := login(t, hostEmail)
	endActiveLives(t, host)
	roomID := createLive(t, host, statusLive, nil)
	mustPublish(t, host, roomID)
	time.Sleep(2 * time.Second)
	call(t, http.MethodPost, "/api/rooms/"+roomID+"/disconnect", host.token, nil)

	l := getLive(t, roomID)
	if !l.HasReplay {
		t.Logf("no replay for a 2 s live: fine")
		return
	}
	if n := replaySegments(t, l.ReplayURL); n == 0 {
		t.Errorf("the live is marked has_replay but its replay has no segment: viewers get an empty player")
	}
}
