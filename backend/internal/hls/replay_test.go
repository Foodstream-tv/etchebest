package hls

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// chdirTemp runs the test from an empty temp dir: the hls package uses ./hls and ./storage/replays.
func chdirTemp(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	prev, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(prev) })
	return dir
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

func TestGenerateReplayMovesTheRecording(t *testing.T) {
	root := chdirTemp(t)
	writeFile(t, filepath.Join(root, "hls", "room-1", "master.m3u8"), "#EXTM3U\n")
	writeFile(t, filepath.Join(root, "hls", "room-1", "720p", "index0.ts"), "segment")

	url, err := GenerateReplay("room-1")
	if err != nil {
		t.Fatalf("GenerateReplay: %v", err)
	}
	if url != "/replays-storage/room-1/master.m3u8" {
		t.Fatalf("unexpected url %q", url)
	}
	if _, err := os.Stat(filepath.Join(root, "storage", "replays", "room-1", "720p", "index0.ts")); err != nil {
		t.Fatalf("replay segment missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "hls", "room-1")); !os.IsNotExist(err) {
		t.Fatalf("source should have been moved, stat err = %v", err)
	}
}

func TestGenerateReplayReplacesAStaleReplay(t *testing.T) {
	root := chdirTemp(t)
	writeFile(t, filepath.Join(root, "hls", "room-1", "master.m3u8"), "#EXTM3U\n")
	writeFile(t, filepath.Join(root, "storage", "replays", "room-1", "old.ts"), "old")

	if _, err := GenerateReplay("room-1"); err != nil {
		t.Fatalf("GenerateReplay: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "storage", "replays", "room-1", "old.ts")); !os.IsNotExist(err) {
		t.Fatalf("stale replay content must be replaced, stat err = %v", err)
	}
}

func TestGenerateReplayWithoutMasterIsNoContent(t *testing.T) {
	root := chdirTemp(t)
	writeFile(t, filepath.Join(root, "hls", "room-1", "stream.sdp"), "sdp")

	_, err := GenerateReplay("room-1")
	if !errors.Is(err, ErrNoReplayContent) {
		t.Fatalf("expected ErrNoReplayContent, got %v", err)
	}
}

func TestStopStreamKeepsTheRecordingWhenTheReplayFails(t *testing.T) {
	root := chdirTemp(t)
	// A live that has a master playlist but whose replay destination cannot be created:
	// storage/replays is a *file*, so neither rename nor copy can succeed.
	writeFile(t, filepath.Join(root, "hls", "room-1", "master.m3u8"), "#EXTM3U\n")
	writeFile(t, filepath.Join(root, "storage", "replays"), "i am a file, not a directory")

	mu.Lock()
	streams["room-1"] = &Stream{RoomID: "room-1", Stop: func() {}}
	mu.Unlock()
	t.Cleanup(func() { mu.Lock(); delete(streams, "room-1"); mu.Unlock() })

	_, err := StopStream("room-1")
	if err == nil {
		t.Fatal("expected the replay to fail")
	}
	if _, statErr := os.Stat(filepath.Join(root, "hls", "room-1", "master.m3u8")); statErr != nil {
		t.Fatalf("the recording must survive a failed replay: %v", statErr)
	}
}

func TestStopStreamRemovesTheSourceWhenThereIsNothingToKeep(t *testing.T) {
	root := chdirTemp(t)
	writeFile(t, filepath.Join(root, "hls", "room-1", "stream.sdp"), "sdp") // no master: ended too early

	mu.Lock()
	streams["room-1"] = &Stream{RoomID: "room-1", Stop: func() {}}
	mu.Unlock()
	t.Cleanup(func() { mu.Lock(); delete(streams, "room-1"); mu.Unlock() })

	if _, err := StopStream("room-1"); !errors.Is(err, ErrNoReplayContent) {
		t.Fatalf("expected ErrNoReplayContent, got %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "hls", "room-1")); !os.IsNotExist(err) {
		t.Fatalf("empty recording should be cleaned up, stat err = %v", err)
	}
}

func TestFinalizeOnePlaylist(t *testing.T) {
	dir := t.TempDir()

	media := filepath.Join(dir, "index.m3u8")
	writeFile(t, media, "#EXTM3U\n#EXTINF:2.0,\nindex0.ts\n")
	if err := finalizeOnePlaylist(media); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(media)
	if strings.Count(string(data), "#EXT-X-ENDLIST") != 1 {
		t.Fatalf("media playlist should end with one ENDLIST: %q", data)
	}
	// idempotent
	if err := finalizeOnePlaylist(media); err != nil {
		t.Fatal(err)
	}
	data, _ = os.ReadFile(media)
	if strings.Count(string(data), "#EXT-X-ENDLIST") != 1 {
		t.Fatalf("ENDLIST must not be appended twice: %q", data)
	}

	// the master playlist must never receive ENDLIST (invalid there)
	master := filepath.Join(dir, "master.m3u8")
	writeFile(t, master, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n720p/index.m3u8\n")
	if err := finalizeOnePlaylist(master); err != nil {
		t.Fatal(err)
	}
	data, _ = os.ReadFile(master)
	if strings.Contains(string(data), "#EXT-X-ENDLIST") {
		t.Fatalf("master playlist must not get ENDLIST: %q", data)
	}

	// a missing playlist is not an error
	if err := finalizeOnePlaylist(filepath.Join(dir, "nope.m3u8")); err != nil {
		t.Fatalf("missing playlist should be ignored: %v", err)
	}
}
