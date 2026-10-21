package room

import (
	"testing"
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
)

func h264State() *hlsState {
	return &hlsState{
		audio:      &hls.CodecInfo{PayloadType: 111, CodecName: "opus", ClockRate: 48000, Channels: 2},
		video:      &hls.CodecInfo{PayloadType: 96, CodecName: "H264", ClockRate: 90000},
		trackCount: 2,
	}
}

func TestHLSWaitsForThePublishersPictureSizeBeforeStarting(t *testing.T) {
	prevWait, prevRetry := hlsSourceWait, hlsStartRetryDelays
	hlsSourceWait, hlsStartRetryDelays = time.Hour, nil
	t.Cleanup(func() { hlsSourceWait, hlsStartRetryDelays = prevWait, prevRetry })

	room := &Room{ID: "room-wait", Host: "host"}
	h := h264State()

	mu.Lock()
	h.tryStartHLS(room, "room-wait")
	h.tryStartHLS(room, "room-wait") // called again by the second track: still waiting, one timer
	mu.Unlock()

	if room.HLSWriter != nil || hls.IsRunning("room-wait") || hls.ActiveLives() != 0 {
		t.Fatal("HLS must not start before the size of the picture is known: the ladder depends on it")
	}
}

func TestHLSStartsWithTheFullLadderWhenNoSPSEverComes(t *testing.T) {
	prevWait, prevRetry := hlsSourceWait, hlsStartRetryDelays
	hlsSourceWait, hlsStartRetryDelays = 20*time.Millisecond, nil
	t.Cleanup(func() { hlsSourceWait, hlsStartRetryDelays = prevWait, prevRetry })
	t.Chdir(t.TempDir())

	room := &Room{ID: "room-nosps", Host: "host"}
	h := h264State()
	mu.Lock()
	h.tryStartHLS(room, "room-nosps")
	mu.Unlock()

	deadline := time.Now().Add(5 * time.Second)
	for {
		mu.Lock()
		unknown := h.src.Width == -1
		mu.Unlock()
		if unknown {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("after the wait HLS must stop waiting for a size that is not coming")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestAKnownSourceSizeDoesNotWait(t *testing.T) {
	prevWait, prevRetry := hlsSourceWait, hlsStartRetryDelays
	hlsSourceWait, hlsStartRetryDelays = time.Hour, nil
	t.Cleanup(func() { hlsSourceWait, hlsStartRetryDelays = prevWait, prevRetry })
	t.Chdir(t.TempDir())

	room := &Room{ID: "room-known", Host: "host"}
	h := h264State()
	h.src = hls.SourceSize{Width: 720, Height: 1280}
	mu.Lock()
	h.tryStartHLS(room, "room-known") // FFmpeg may fail to encode on this machine: only "did not wait" matters
	mu.Unlock()
	// had it waited, a timer would be armed (and a started pipeline books a slot, a failed one gives it back)
	armed := false
	h.waitOnce.Do(func() { armed = true })
	if !armed {
		t.Fatal("with a known size, no wait timer must have been armed")
	}
	if room.HLSWriter != nil {
		t.Cleanup(func() { hls.DiscardStream("room-known") })
	}
}
