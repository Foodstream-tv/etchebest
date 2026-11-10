package hls

import (
	"context"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"time"
)

// Nothing else removes what a crashed live leaves behind: its HLS tree (several GB for a long one) and its
// work directory. The janitor deletes the trees of rooms that have no running pipeline and have not been
// written to for a while. A recording kept on purpose after a failed replay is covered too, by the TTL.

const (
	defaultOrphanTTLHours = 72
	janitorInterval       = 10 * time.Minute
)

// newestModTime is the most recent modification of any FILE under dir (a live writes into subfolders, and
// folders get touched when they are created or listed into: their own time says nothing). A tree with no
// file at all falls back to the time of the folder itself.
func newestModTime(dir string) time.Time {
	var newest time.Time
	_ = filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, infoErr := d.Info(); infoErr == nil && info.ModTime().After(newest) {
			newest = info.ModTime()
		}
		return nil
	})
	if newest.IsZero() {
		if info, err := os.Stat(dir); err == nil {
			return info.ModTime()
		}
	}
	return newest
}

// SweepOrphans deletes the per-room folders of the live tree and of the work directory that belong to no
// running pipeline and were last written more than ttl ago. It returns the room ids it cleaned.
func SweepOrphans(now time.Time, ttl time.Duration) []string {
	var removed []string
	for _, base := range []string{liveDir, workDir} {
		entries, err := os.ReadDir(base)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() || !roomIDPattern.MatchString(entry.Name()) {
				continue // not ours: never delete what we did not create
			}
			roomID := entry.Name()
			if IsRunning(roomID) {
				continue
			}
			dir := filepath.Join(base, roomID)
			newest := newestModTime(dir)
			if newest.IsZero() || now.Sub(newest) <= ttl {
				continue
			}
			if err := os.RemoveAll(dir); err != nil {
				log.Printf("[HLS] janitor: could not delete %s: %v", dir, err)
				continue
			}
			removed = append(removed, roomID)
			log.Printf("[HLS] janitor: deleted the leftovers of room %s (%s), untouched since %s", roomID, base, newest.Format(time.RFC3339))
		}
	}
	return removed
}

// StartJanitor sweeps once now, then every few minutes until ctx is cancelled.
func StartJanitor(ctx context.Context) {
	ttl, err := orphanTTL()
	if err != nil {
		log.Printf("[HLS] janitor disabled: %v", err)
		return
	}
	go func() {
		SweepOrphans(time.Now(), ttl)
		ticker := time.NewTicker(janitorInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				SweepOrphans(now, ttl)
			}
		}
	}()
}
