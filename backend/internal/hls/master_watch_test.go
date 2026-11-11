package hls

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// watchLogs runs watchMasterPlaylist with short timings and returns what it logged.
func watchLogs(t *testing.T, roomID, master string, during func()) string {
	t.Helper()
	prevPoll, prevWarn := masterPollInterval, masterWarnAfter
	masterPollInterval, masterWarnAfter = 10*time.Millisecond, 200*time.Millisecond
	t.Cleanup(func() { masterPollInterval, masterWarnAfter = prevPoll, prevWarn })
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })

	done := make(chan struct{})
	go func() { watchMasterPlaylist(roomID, master); close(done) }()
	during()
	<-done
	return buf.String()
}

func running(t *testing.T, roomID string) {
	t.Helper()
	RegisterToStream(roomID, func() {}, nil)
	t.Cleanup(func() { mu.Lock(); delete(streams, roomID); mu.Unlock() })
}

func TestAMasterThatAppearsLaterIsNoError(t *testing.T) {
	master := filepath.Join(t.TempDir(), "master.m3u8")
	running(t, "watch-late")
	out := watchLogs(t, "watch-late", master, func() {
		_ = os.WriteFile(master, []byte("#EXTM3U\n"), 0o644) // FFmpeg creates it at once, empty of renditions
		time.Sleep(80 * time.Millisecond)
		_ = os.WriteFile(master, []byte(masterWithRendition), 0o644)
	})
	if !strings.Contains(out, "master playlist ready") || strings.Contains(out, "WARNING") || strings.Contains(out, "ERROR") {
		t.Errorf("logged %q, want only the ready line", out)
	}
}

func TestAMasterThatNeverAppearsIsWarnedAbout(t *testing.T) {
	running(t, "watch-never")
	out := watchLogs(t, "watch-never", filepath.Join(t.TempDir(), "master.m3u8"), func() {})
	if !strings.Contains(out, "WARNING: room watch-never has no master playlist") {
		t.Errorf("logged %q, want a warning", out)
	}
}

func TestAStoppedPipelineIsNotWarnedAbout(t *testing.T) {
	out := watchLogs(t, "watch-stopped", filepath.Join(t.TempDir(), "master.m3u8"), func() {})
	if out != "" {
		t.Errorf("logged %q for a pipeline that is not running", out)
	}
}
