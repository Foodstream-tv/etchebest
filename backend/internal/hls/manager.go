package hls

import (
	"log"
	"os"
	"strings"
	"sync"
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

func finalizePlaylist(roomID string) {
	playlistPath := "./hls/" + roomID + "/index.m3u8"

	data, err := os.ReadFile(playlistPath)
	if err != nil {
		log.Printf("[HLS] cannot finalize playlist for room %s: %v", roomID, err)
		return
	}

	content := string(data)
	if strings.Contains(content, "#EXT-X-ENDLIST") {
		return
	}

	content += "\n#EXT-X-ENDLIST\n"

	if err := os.WriteFile(playlistPath, []byte(content), 0644); err != nil {
		log.Printf("[HLS] cannot write finalized playlist for room %s: %v", roomID, err)
		return
	}

	log.Printf("[HLS] playlist finalized for room %s", roomID)
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

	stream.Stop()

	finalizePlaylist(roomID)

	replayURL, err := GenerateReplay(roomID)
	if err != nil {
		log.Printf("[REPLAY] failed to generate replay for room %s: %v", roomID, err)
	} else {
		log.Printf("[REPLAY] replay generated: %s", replayURL)
	}

	if err := os.RemoveAll("./hls/" + roomID); err != nil {
		log.Printf("[HLS] cleanup failed for room %s: %v", roomID, err)
	}

	return replayURL, err
}