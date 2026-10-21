package hls

import (
	"bytes"
	"fmt"
	"image"
	_ "image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestTheFilterGraphNeverPadsAndNamesEveryRendition(t *testing.T) {
	for _, l := range []Ladder{FullLadder, LightLadder} {
		g := l.filterGraph()
		if strings.Contains(g, "pad=") {
			t.Errorf("%s: a padded picture letterboxes portrait videos: %s", l.Name, g)
		}
		for i := range l.Rungs {
			if !strings.Contains(g, fmt.Sprintf("[v%dout]", i)) {
				t.Errorf("%s: rendition %d is not produced by the graph", l.Name, i)
			}
		}
		args := buildFFmpegArgs("/s.sdp", "/h", false, l)
		joined := strings.Join(args, " ")
		if !strings.Contains(joined, l.varStreamMap()) {
			t.Errorf("%s: variant map missing from the command", l.Name)
		}
		if got := strings.Count(joined, "libx264"); got != len(l.Rungs) {
			t.Errorf("%s: %d encodes for %d renditions", l.Name, got, len(l.Rungs))
		}
	}
	if len(FullLadder.Rungs) != 4 || len(LightLadder.Rungs) != 2 {
		t.Errorf("ladders: %d and %d renditions, want 4 and 2", len(FullLadder.Rungs), len(LightLadder.Rungs))
	}
	if LightLadder.Rungs[0].Name != "480p" {
		t.Error("the light ladder keeps the two smallest renditions")
	}
}

// renderedSize runs the real FFmpeg filter graph on a synthetic source and returns the picture size
// of each rendition. It needs an ffmpeg binary (the encoders do not matter: PNG is used).
func renderedSizes(t *testing.T, l Ladder, w, h int) []image.Point {
	t.Helper()
	dir := t.TempDir()
	args := []string{"-v", "error", "-f", "lavfi", "-i", fmt.Sprintf("testsrc=size=%dx%d:rate=30:duration=0.2", w, h), "-filter_complex", l.filterGraph()}
	var sizes []image.Point
	for i := range l.Rungs {
		args = append(args, "-map", fmt.Sprintf("[v%dout]", i), "-frames:v", "1", filepath.Join(dir, fmt.Sprintf("r%d.png", i)))
	}
	var stderr bytes.Buffer
	cmd := exec.Command("ffmpeg", args...)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		t.Fatalf("ffmpeg: %v\n%s", err, stderr.String())
	}
	for i := range l.Rungs {
		f, err := os.Open(filepath.Join(dir, fmt.Sprintf("r%d.png", i)))
		if err != nil {
			t.Fatal(err)
		}
		cfg, _, err := image.DecodeConfig(f)
		f.Close()
		if err != nil {
			t.Fatal(err)
		}
		sizes = append(sizes, image.Point{cfg.Width, cfg.Height})
	}
	return sizes
}

func TestRenditionsKeepTheShapeOfTheSourceAndNeverEnlarge(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	sources := []struct {
		name string
		w, h int
	}{
		{"1080p landscape", 1920, 1080},
		{"720p landscape", 1280, 720},
		{"480p landscape", 854, 480},
		{"phone portrait 720p", 720, 1280},
		{"phone portrait 1080p", 1080, 1920},
		{"small portrait", 360, 640},
		{"square", 800, 800},
		{"odd sizes", 721, 1281},
	}
	for _, src := range sources {
		for _, l := range []Ladder{FullLadder, LightLadder} {
			sizes := renderedSizes(t, l, src.w, src.h)
			srcRatio := float64(src.w) / float64(src.h)
			for i, got := range sizes {
				name := fmt.Sprintf("%s / %s %s", src.name, l.Name, l.Rungs[i].Name)
				if got.X%2 != 0 || got.Y%2 != 0 {
					t.Errorf("%s: %dx%d is not even (x264 refuses it)", name, got.X, got.Y)
				}
				if got.X > src.w+1 || got.Y > src.h+1 {
					t.Errorf("%s: %dx%d enlarges the %dx%d source", name, got.X, got.Y, src.w, src.h)
				}
				if ratio := float64(got.X) / float64(got.Y); ratio < srcRatio*0.98 || ratio > srcRatio*1.02 {
					t.Errorf("%s: aspect %.3f, source %.3f (padded or stretched)", name, ratio, srcRatio)
				}
				if (src.w > src.h) != (got.X > got.Y) && src.w != src.h && abs(src.w-src.h) > 2 {
					t.Errorf("%s: %dx%d changed orientation", name, got.X, got.Y)
				}
				short := min(got.X, got.Y)
				if short > l.Rungs[i].Short {
					t.Errorf("%s: short side %d above the rendition's %d", name, short, l.Rungs[i].Short)
				}
			}
		}
	}

	// the headline case: a 720p phone stream stays portrait in every rendition
	for i, got := range renderedSizes(t, FullLadder, 720, 1280) {
		if got.X >= got.Y {
			t.Errorf("rendition %d of a portrait stream is %dx%d", i, got.X, got.Y)
		}
	}
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func TestCapacityPicksTheLadderFromTheLoadAndRefusesBeyondTheCap(t *testing.T) {
	t.Setenv("HLS_MAX_LIVES", "4")
	t.Setenv("HLS_FULL_LADDER_LIVES", "2")
	var releases []func()
	want := []string{"full", "full", "light", "light"}
	for i, w := range want {
		ladder, release, err := reserveSlot(fmt.Sprintf("room-%d", i))
		if err != nil {
			t.Fatalf("live %d: %v", i, err)
		}
		releases = append(releases, release)
		if ladder.Name != w {
			t.Errorf("live %d got the %q ladder, want %q", i, ladder.Name, w)
		}
	}
	if _, _, err := reserveSlot("room-over"); err != ErrTooManyLives {
		t.Fatalf("a 5th live must be refused with ErrTooManyLives, got %v", err)
	}
	if _, _, err := reserveSlot("room-0"); err == nil {
		t.Error("a room cannot hold two pipelines")
	}

	releases[0]()
	releases[0]() // idempotent
	if ActiveLives() != 3 {
		t.Fatalf("%d active lives after one release, want 3", ActiveLives())
	}
	if ladder, release, err := reserveSlot("room-new"); err != nil || ladder.Name != "light" {
		t.Fatalf("a freed place is reusable, under load it is the light ladder: %v %q", err, ladder.Name)
	} else {
		releases = append(releases, release)
	}
	for _, r := range releases {
		r()
	}
	if ActiveLives() != 0 {
		t.Errorf("%d slots leaked", ActiveLives())
	}
}

func TestCapacityIsRaceFree(t *testing.T) {
	t.Setenv("HLS_MAX_LIVES", "3")
	t.Setenv("HLS_FULL_LADDER_LIVES", "3")
	var wg sync.WaitGroup
	var mu sync.Mutex
	granted := 0
	var releases []func()
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if _, release, err := reserveSlot(fmt.Sprintf("race-%d", i)); err == nil {
				mu.Lock()
				granted++
				releases = append(releases, release)
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()
	if granted != 3 {
		t.Fatalf("%d slots granted for a cap of 3", granted)
	}
	for _, r := range releases {
		r()
	}
}

func TestCapacityConfigurationFailsFast(t *testing.T) {
	for name, env := range map[string]map[string]string{
		"not a number":     {"HLS_MAX_LIVES": "many"},
		"negative":         {"HLS_FULL_LADDER_LIVES": "-1"},
		"full above total": {"HLS_MAX_LIVES": "2", "HLS_FULL_LADDER_LIVES": "3"},
	} {
		for k, v := range env {
			t.Setenv(k, v)
		}
		if ValidateConfig() == nil {
			t.Errorf("%s: must be refused", name)
		}
		for k := range env {
			t.Setenv(k, "")
		}
	}
	if err := ValidateConfig(); err != nil {
		t.Errorf("defaults must be valid: %v", err)
	}
	t.Setenv("HLS_MAX_LIVES", "0") // 0 = no cap
	t.Setenv("HLS_FULL_LADDER_LIVES", "5")
	if err := ValidateConfig(); err != nil {
		t.Errorf("no cap must be valid: %v", err)
	}
}
