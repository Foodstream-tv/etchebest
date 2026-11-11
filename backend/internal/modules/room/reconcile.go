package room

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/Foodstream-io/etchebest/internal/hls"
	liveModule "github.com/Foodstream-io/etchebest/internal/modules/live"
	"gorm.io/gorm"
)

const roomIDColumn = "room_id"

var (
	// Long enough for the host to survive a network switch or an app restart.
	hostAbsentGrace = 60 * time.Second
	// A scheduled live blocks its host (one active or scheduled live per person) until then.
	staleScheduledAfter = 12 * time.Hour
)

// Must be called with mu held.
func armHostAbsentTimer(db *gorm.DB, room *Room, roomID string) {
	stopHostAbsentTimer(room)
	var timer *time.Timer
	timer = time.AfterFunc(hostAbsentGrace, func() {
		mu.Lock()
		if room.hostAbsentTimer != timer || room.HostPeerCon != nil || peekLiveRoom(roomID) != room {
			mu.Unlock()
			return
		}
		room.hostAbsentTimer = nil
		conns := detachRoom(room, roomID)
		mu.Unlock()
		finishRoom(db, roomID, "the host did not come back", conns)
	})
	room.hostAbsentTimer = timer
	log.Printf("room %s: host gone, the live ends in %s unless the host reconnects", roomID, hostAbsentGrace)
}

// Must be called with mu held.
func stopHostAbsentTimer(room *Room) {
	if room.hostAbsentTimer != nil {
		room.hostAbsentTimer.Stop()
		room.hostAbsentTimer = nil
	}
}

// ReconcileOnBoot ends the lives interrupted by a server stop and deletes the rooms no scheduled live
// owns. Must run before the server accepts requests.
func ReconcileOnBoot(db *gorm.DB) {
	var stale []liveModule.Live
	if err := db.Select("id", roomIDColumn).Where("status = ?", "live").Find(&stale).Error; err != nil {
		log.Printf("[RECONCILE] could not list the running lives: %v", err)
	}
	for _, l := range stale {
		replayURL := recoverRecording(db, l.RoomID)
		markLiveAsEndedByRoomID(db, l.RoomID, replayURL)
		log.Printf("[RECONCILE] live %d (room %s) was running when the server stopped: ended, replay %q", l.ID, l.RoomID, replayURL)
	}

	upcoming := db.Model(&liveModule.Live{}).Select(roomIDColumn).
		Where("status = ? AND room_id IS NOT NULL", "scheduled")
	res := db.Where("id NOT IN (?)", upcoming).Delete(&Room{})
	if res.Error != nil {
		log.Printf("[RECONCILE] could not delete the orphan rooms: %v", res.Error)
	} else if res.RowsAffected > 0 {
		log.Printf("[RECONCILE] deleted %d room(s) of lives that are not scheduled any more", res.RowsAffected)
	}
}

func recoverRecording(db *gorm.DB, roomID string) string {
	if !liveModule.IsRecorded(db, roomID) {
		hls.DiscardStream(roomID)
		return ""
	}
	replayURL, err := hls.RecoverRecording(roomID)
	if err != nil {
		if !errors.Is(err, hls.ErrNoReplayContent) {
			log.Printf("[RECONCILE] replay of room %s not rebuilt: %v", roomID, err)
		}
		return ""
	}
	return replayURL
}

// EndStaleScheduledLives ends the scheduled lives more than staleScheduledAfter past their time (their
// creation when they have none) that nobody is connected to.
func EndStaleScheduledLives(db *gorm.DB, now time.Time) []string {
	var stale []liveModule.Live
	if err := db.Select("id", roomIDColumn).
		Where("status = ? AND COALESCE(scheduled_at, created_at) < ?", "scheduled", now.Add(-staleScheduledAfter)).
		Find(&stale).Error; err != nil {
		log.Printf("[RECONCILE] could not list the stale scheduled lives: %v", err)
		return nil
	}
	var ended []string
	for _, l := range stale {
		mu.Lock()
		room := peekLiveRoom(l.RoomID)
		if isClosing(l.RoomID) || (room != nil && len(room.Connections) > 0) {
			mu.Unlock()
			continue
		}
		detachRoom(room, l.RoomID)
		mu.Unlock()
		finishRoom(db, l.RoomID, "scheduled live never started", nil)
		ended = append(ended, l.RoomID)
		log.Printf("[RECONCILE] scheduled live %d (room %s) never started: ended", l.ID, l.RoomID)
	}
	return ended
}

func StartScheduledLivesJanitor(ctx context.Context, db *gorm.DB, interval time.Duration) {
	go func() {
		EndStaleScheduledLives(db, time.Now())
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				EndStaleScheduledLives(db, now)
			}
		}
	}()
}
