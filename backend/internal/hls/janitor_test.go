package hls

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"
)

func tree(t *testing.T, base, room string, age time.Duration) {
	t.Helper()
	dir := filepath.Join(base, room, "720p")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(dir, "segment_000.ts")
	if err := os.WriteFile(file, []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-age)
	if err := os.Chtimes(file, old, old); err != nil {
		t.Fatal(err)
	}
}

func TestTheJanitorDeletesOnlyOldTreesOfNoRunningPipeline(t *testing.T) {
	t.Chdir(t.TempDir())
	tree(t, liveDir, "crashed-old", 100*time.Hour) // a crashed live, long ago
	tree(t, liveDir, "crashed-fresh", 2*time.Hour) // maybe a recovery in progress
	tree(t, liveDir, "running-old", 100*time.Hour) // untouched for days but a pipeline owns it
	tree(t, workDir, "crashed-old", 100*time.Hour) // its work directory goes too
	tree(t, liveDir, "not.a.room", 100*time.Hour)  // not a name we create
	if err := os.WriteFile(filepath.Join(liveDir, "loose-file"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}

	RegisterToStream("running-old", func() {}, nil)
	t.Cleanup(func() { mu.Lock(); delete(streams, "running-old"); mu.Unlock() })

	removed := SweepOrphans(time.Now(), 72*time.Hour)
	sort.Strings(removed)
	if len(removed) != 2 || removed[0] != "crashed-old" || removed[1] != "crashed-old" {
		t.Errorf("removed %v, want the live tree and the work dir of crashed-old", removed)
	}
	for path, want := range map[string]bool{
		filepath.Join(liveDir, "crashed-old"):   false,
		filepath.Join(workDir, "crashed-old"):   false,
		filepath.Join(liveDir, "crashed-fresh"): true,
		filepath.Join(liveDir, "running-old"):   true,
		filepath.Join(liveDir, "not.a.room"):    true,
		filepath.Join(liveDir, "loose-file"):    true,
	} {
		if got := exists(path); got != want {
			t.Errorf("%s exists = %v, want %v", path, got, want)
		}
	}
}

func TestTheJanitorJudgesATreeByItsNewestFile(t *testing.T) {
	t.Chdir(t.TempDir())
	tree(t, liveDir, "live-room", 100*time.Hour) // an old segment...
	fresh := filepath.Join(liveDir, "live-room", "720p", "segment_001.ts")
	if err := os.WriteFile(fresh, []byte("x"), 0644); err != nil { // ...and one just written
		t.Fatal(err)
	}
	if removed := SweepOrphans(time.Now(), 72*time.Hour); len(removed) != 0 {
		t.Errorf("a tree written to a moment ago must be kept, removed %v", removed)
	}
}

func TestTheJanitorSurvivesMissingDirectories(t *testing.T) {
	t.Chdir(t.TempDir())
	if removed := SweepOrphans(time.Now(), time.Hour); len(removed) != 0 {
		t.Errorf("nothing to clean, got %v", removed)
	}
}
