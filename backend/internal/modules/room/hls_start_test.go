package room

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
)

// recorder replaces hls.Start: no FFmpeg is launched, the test only sees what would have been asked.
type recorder struct {
	mu    sync.Mutex
	calls []hls.SourceSize
}

func (r *recorder) start(_ string, _, _ *hls.CodecInfo, src hls.SourceSize) (*hls.HLSWriter, func(), error) {
	r.mu.Lock()
	r.calls = append(r.calls, src)
	r.mu.Unlock()
	return nil, nil, errors.New("fake: no FFmpeg in this test")
}

func (r *recorder) seen() []hls.SourceSize {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]hls.SourceSize(nil), r.calls...)
}

func h264State(r *recorder) *hlsState {
	return &hlsState{
		audio:      &hls.CodecInfo{PayloadType: 111, CodecName: "opus", ClockRate: 48000, Channels: 2},
		video:      &hls.CodecInfo{PayloadType: 96, CodecName: "H264", ClockRate: 90000},
		trackCount: 2,
		start:      r.start,
	}
}

func fastTimings(t *testing.T, wait time.Duration) {
	t.Helper()
	prevWait, prevRetry := hlsSourceWait, hlsStartRetryDelays
	hlsSourceWait, hlsStartRetryDelays = wait, nil
	t.Cleanup(func() { hlsSourceWait, hlsStartRetryDelays = prevWait, prevRetry })
}

func TestHLSWaitsForThePublishersPictureSizeBeforeStarting(t *testing.T) {
	fastTimings(t, time.Hour)
	r := &recorder{}
	room := &Room{ID: "room-wait", Host: "host"}
	h := h264State(r)

	mu.Lock()
	h.tryStartHLS(room, "room-wait")
	h.tryStartHLS(room, "room-wait") // the second track calls again: still waiting, one timer
	mu.Unlock()

	if len(r.seen()) != 0 {
		t.Fatal("HLS must not start before the size of the picture is known: the ladder depends on it")
	}
}

func TestHLSStartsWithTheSizeOnceItIsKnown(t *testing.T) {
	fastTimings(t, time.Hour)
	r := &recorder{}
	room := &Room{ID: "room-size", Host: "host"}
	h := h264State(r)

	mu.Lock()
	h.tryStartHLS(room, "room-size") // waiting
	h.src = hls.SourceSize{Width: 720, Height: 1280}
	h.tryStartHLS(room, "room-size") // what the SPS callback does
	mu.Unlock()

	calls := r.seen()
	if len(calls) != 1 || calls[0] != (hls.SourceSize{Width: 720, Height: 1280}) {
		t.Fatalf("HLS start calls = %+v, want one with 720x1280", calls)
	}
}

func TestHLSStartsWithTheFullLadderWhenNoSPSEverComes(t *testing.T) {
	fastTimings(t, 20*time.Millisecond)
	r := &recorder{}
	room := &Room{ID: "room-nosps", Host: "host"}
	h := h264State(r)

	mu.Lock()
	h.tryStartHLS(room, "room-nosps")
	mu.Unlock()

	deadline := time.Now().Add(5 * time.Second)
	for len(r.seen()) == 0 {
		if time.Now().After(deadline) {
			t.Fatal("after the wait HLS must start anyway: waiting forever would mean no replay at all")
		}
		time.Sleep(5 * time.Millisecond)
	}
	// The timer callback holds mu for the whole of tryStartHLS: once we get it, nothing of it is still
	// running (and the timings restored by the cleanup are no longer read).
	mu.Lock()
	mu.Unlock() //nolint:staticcheck // empty critical section on purpose: a barrier
	if got := r.seen()[0]; got != (hls.SourceSize{}) {
		t.Fatalf("an unknown size must be passed as 0x0 (full ladder), got %+v", got)
	}
}

func TestANonH264PublisherNeverStartsHLS(t *testing.T) {
	fastTimings(t, 10*time.Millisecond)
	r := &recorder{}
	h := h264State(r)
	h.video.CodecName = "VP8"
	room := &Room{ID: "room-vp8", Host: "host"}
	mu.Lock()
	h.tryStartHLS(room, "room-vp8")
	mu.Unlock()
	time.Sleep(60 * time.Millisecond)
	if len(r.seen()) != 0 {
		t.Fatal("HLS needs H.264")
	}
}
