package hls

import (
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
	qualities := []string{"1080p", "720p", "480p", "360p"}
	
	for _, quality := range qualities {
		indexPath := filepath.Join("./hls", roomID, quality, "index.m3u8")
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

	mu.Lock()
	delete(tokens, roomID)
	mu.Unlock()

	return replayURL, err
}
