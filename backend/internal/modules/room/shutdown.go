package room

import (
	"maps"
	"sync"

	"github.com/Foodstream-io/etchebest/internal/hls"
	"gorm.io/gorm"
)

// EndRunningLives ends every live running on this server (someone connected, or a pipeline recording) as
// if its host had stopped it, and returns once their replays are written. A scheduled live nobody joined
// yet is left alone: it is still scheduled after the restart. Used when the server stops.
func EndRunningLives(db *gorm.DB) int {
	liveRoomsMu.Lock()
	rooms := maps.Clone(liveRooms)
	liveRoomsMu.Unlock()

	var wg sync.WaitGroup
	ended := 0
	for id, r := range rooms {
		mu.Lock()
		running := peekLiveRoom(id) == r && (len(r.Connections) > 0 || hls.IsRunning(id))
		var conns []PeerConnection
		if running {
			conns = detachRoom(r, id)
		}
		mu.Unlock()
		if !running {
			continue
		}
		ended++
		// In parallel: each one waits for its FFmpeg, and Docker kills the process after its grace period.
		wg.Go(func() { finishRoom(db, id, "the server is stopping", conns) })
	}
	wg.Wait()
	return ended
}
