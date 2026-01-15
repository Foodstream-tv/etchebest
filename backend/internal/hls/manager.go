package hls

import (
	"os"
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

func StopStream(roomID string) {
	mu.Lock()
	defer mu.Unlock()

	if stream, exists := streams[roomID]; exists {
		stream.Stop()
		delete(streams, roomID)
		os.RemoveAll("./hls/" + roomID)
	}
}
