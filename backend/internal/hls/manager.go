package hls

import (
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Stream struct {
	RoomID string
	Stop   func()
	status func() Status
}

var (
	streams = make(map[string]*Stream)
	mu      sync.Mutex
)

func IsRunning(roomID string) bool {
	mu.Lock()
	defer mu.Unlock()
	_, exists := streams[roomID]
	return exists
}

// StatusOf is the health of the room's HLS pipeline, or "" when the room has none.
func StatusOf(roomID string) Status {
	mu.Lock()
	stream, exists := streams[roomID]
	mu.Unlock()
	if !exists || stream.status == nil {
		return ""
	}
	return stream.status()
}

func RegisterToStream(roomID string, stop func(), status func() Status) {
	mu.Lock()
	defer mu.Unlock()
	streams[roomID] = &Stream{
		RoomID: roomID,
		Stop:   stop,
		status: status,
	}

	// Log segment generation progress every 2 seconds
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			mu.Lock()
			_, exists := streams[roomID]
			mu.Unlock()

			if !exists {
				return // Stream stopped
			}

			logSegmentStatus(roomID)
		}
	}()
}

func logSegmentStatus(roomID string) {
	qualities := qualityNames()
	const playlistFile = "index.m3u8"

	for _, quality := range qualities {
		indexPath := filepath.Join("./hls", roomID, quality, playlistFile)
		data, err := os.ReadFile(indexPath)
		if err != nil {
			continue
		}

		// Count segments in the playlist
		lines := strings.Split(string(data), "\n")
		segmentCount := 0
		for _, line := range lines {
			if strings.HasPrefix(line, "segment_") {
				segmentCount++
			}
		}

		log.Printf("[HLS] %s: %d segments ready", quality, segmentCount)
	}
}

func finalizePlaylist(roomID string) error {
	const playlistFile = "index.m3u8"
	playlists := []string{filepath.Join("./hls", roomID, "master.m3u8")}
	for _, quality := range qualityNames() { // a light-ladder live has no 1080p/720p: missing files are skipped
		playlists = append(playlists, filepath.Join("./hls", roomID, quality, playlistFile))
	}

	for _, playlistPath := range playlists {
		if err := finalizeOnePlaylist(playlistPath); err != nil {
			return err
		}
	}

	log.Printf("[HLS] playlists finalized for room %s", roomID)

	return nil
}

func finalizeOnePlaylist(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	// #EXT-X-ENDLIST is only valid in media playlists, never in the master playlist.
	if filepath.Base(path) == "master.m3u8" {
		return nil
	}

	content := string(data)

	if strings.Contains(content, "#EXT-X-ENDLIST") {
		return nil
	}

	content += "\n#EXT-X-ENDLIST\n"

	return os.WriteFile(path, []byte(content), 0644)
}

// DiscardStream ends the room's HLS pipeline and deletes everything it recorded: no replay is made.
// Used when the host chose not to keep one.
func DiscardStream(roomID string) {
	mu.Lock()
	stream, exists := streams[roomID]
	delete(streams, roomID)
	mu.Unlock()
	if exists {
		stream.Stop()
	}
	if roomID == "" || roomID != filepath.Base(roomID) || roomID == "." || roomID == ".." {
		return
	}
	if err := os.RemoveAll(filepath.Join("./hls", roomID)); err != nil {
		log.Printf("[HLS] could not delete the recording of room %s: %v", roomID, err)
	}
}

func StopStream(roomID string) (string, error) {
	mu.Lock()

	stream, exists := streams[roomID]
	if !exists {
		mu.Unlock()
		return "", nil
	}

	delete(streams, roomID)
	mu.Unlock()
	time.Sleep(2 * time.Second)
	stream.Stop()

	if err := finalizePlaylist(roomID); err != nil {
		log.Printf("[HLS] failed to finalize playlists for room %s: %v", roomID, err)
	}

	replayURL, err := GenerateReplay(roomID)
	if err != nil {
		log.Printf("[REPLAY] failed to generate replay for room %s: %v", roomID, err)
	} else {
		log.Printf("[REPLAY] replay generated: %s", replayURL)
	}

	// Only delete the recording once it is safely stored as a replay (or when there was nothing to
	// keep). A failed replay (disk full, copy error) must never also destroy its only source.
	sourceDir := filepath.Join("./hls", roomID)
	switch {
	case err == nil, errors.Is(err, ErrNoReplayContent):
		if rmErr := os.RemoveAll(sourceDir); rmErr != nil {
			log.Printf("[HLS] cleanup failed for room %s: %v", roomID, rmErr)
		}
	default:
		log.Printf("[HLS] replay failed for room %s: keeping the recording in %s for recovery", roomID, sourceDir)
	}

	return replayURL, err
}
