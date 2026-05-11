package hls

import (
	"log"
	"os"
	"strings"
	"sync"
	"path/filepath"
	"time"
)

type Stream struct {
	RoomID string
	Stop   func()
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

func RegisterToStream(roomID string, stop func()) {
	mu.Lock()
	defer mu.Unlock()
	streams[roomID] = &Stream{
		RoomID: roomID,
		Stop:   stop,
	}
}

func finalizePlaylist(roomID string) error {
	playlists := []string{
		filepath.Join("./hls", roomID, "master.m3u8"),
		filepath.Join("./hls", roomID, "1080p", "index.m3u8"),
		filepath.Join("./hls", roomID, "720p", "index.m3u8"),
		filepath.Join("./hls", roomID, "480p", "index.m3u8"),
		filepath.Join("./hls", roomID, "360p", "index.m3u8"),
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

	content := string(data)

	if strings.Contains(content, "#EXT-X-ENDLIST") {
		return nil
	}

	content += "\n#EXT-X-ENDLIST\n"

	return os.WriteFile(path, []byte(content), 0644)
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

	if err := os.RemoveAll(filepath.Join("./hls", roomID)); err != nil {
		log.Printf("[HLS] cleanup failed for room %s: %v", roomID, err)
	}

	return replayURL, err
}