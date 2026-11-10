package hls

import (
	"fmt"
	"strings"
	"testing"
)

// eventPlaylist builds what FFmpeg writes: a growing EVENT playlist of n 2-second segments.
func eventPlaylist(n int, ended bool, discontinuityAt ...int) string {
	var b strings.Builder
	b.WriteString("#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXT-X-INDEPENDENT-SEGMENTS\n")
	disc := map[int]bool{}
	for _, d := range discontinuityAt {
		disc[d] = true
	}
	for i := 0; i < n; i++ {
		if disc[i] {
			b.WriteString("#EXT-X-DISCONTINUITY\n")
		}
		fmt.Fprintf(&b, "#EXTINF:2.000000,\nsegment_%03d.ts\n", i)
	}
	if ended {
		b.WriteString("#EXT-X-ENDLIST\n")
	}
	return b.String()
}

func segmentsOf(playlist string) []string {
	var out []string
	for _, l := range strings.Split(playlist, "\n") {
		if strings.HasSuffix(l, ".ts") {
			out = append(out, l)
		}
	}
	return out
}

func TestAThreeHourLiveStaysUnderTwentyKilobytes(t *testing.T) {
	full := eventPlaylist(5400, false) // 3 h of 2 s segments
	window := WindowPlaylist([]byte(full), defaultLiveWindow)
	if len(full) < 100_000 {
		t.Fatalf("test premise: the full playlist is only %d bytes", len(full))
	}
	if len(window) >= 20_000 {
		t.Fatalf("the live window is %d bytes, want under 20 KB (the full playlist is %d)", len(window), len(full))
	}
	t.Logf("full %d bytes -> window %d bytes", len(full), len(window))
}

func TestTheWindowKeepsTheLastSegmentsAndTheRightSequence(t *testing.T) {
	out := string(WindowPlaylist([]byte(eventPlaylist(25, false)), 10))
	got := segmentsOf(out)
	if len(got) != 10 || got[0] != "segment_015.ts" || got[9] != "segment_024.ts" {
		t.Fatalf("window = %v, want segment_015 to segment_024", got)
	}
	if !strings.Contains(out, "#EXT-X-MEDIA-SEQUENCE:15\n") {
		t.Errorf("the media sequence must be the index of the first segment kept (15):\n%s", out)
	}
	if strings.Contains(out, "PLAYLIST-TYPE") {
		t.Error("a sliding window is not append-only: it must not declare PLAYLIST-TYPE (EVENT)")
	}
	if strings.Contains(out, "ENDLIST") {
		t.Error("a live window never ends")
	}
	for _, want := range []string{"#EXT-X-TARGETDURATION:2\n", "#EXT-X-VERSION:6\n", "#EXT-X-INDEPENDENT-SEGMENTS\n", "#EXT-X-START:TIME-OFFSET=-6.0,PRECISE=NO\n"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q:\n%s", strings.TrimSpace(want), out)
		}
	}
	// the sequence keeps counting as the live goes on: a player can tell what slid out
	next := string(WindowPlaylist([]byte(eventPlaylist(26, false)), 10))
	if !strings.Contains(next, "#EXT-X-MEDIA-SEQUENCE:16\n") {
		t.Errorf("one segment later the sequence must be 16:\n%s", next)
	}
}

func TestShortPlaylistsAndTheClampedWindow(t *testing.T) {
	out := string(WindowPlaylist([]byte(eventPlaylist(4, false)), 10))
	if got := segmentsOf(out); len(got) != 4 || !strings.Contains(out, "MEDIA-SEQUENCE:0\n") {
		t.Errorf("fewer segments than the window: everything is kept from the start, got %v\n%s", got, out)
	}
	if strings.Contains(out, "PLAYLIST-TYPE") {
		t.Error("the type must not change when the playlist grows past the window: never declared")
	}
	if got := segmentsOf(string(WindowPlaylist([]byte(eventPlaylist(20, false)), 1))); len(got) != minLiveWindow {
		t.Errorf("a window below %d segments is raised to it, got %d", minLiveWindow, len(got))
	}
	if out := string(WindowPlaylist(nil, 10)); !strings.HasPrefix(out, "#EXTM3U") || len(segmentsOf(out)) != 0 {
		t.Errorf("an empty file must give an empty valid playlist, got %q", out)
	}
}

func TestDiscontinuitiesThatSlideOutAreCounted(t *testing.T) {
	// FFmpeg restarted twice: before segment 2 and before segment 12
	full := eventPlaylist(20, false, 2, 12)
	out := string(WindowPlaylist([]byte(full), 5)) // keeps segments 15 to 19: both discontinuities are behind it
	if !strings.Contains(out, "#EXT-X-DISCONTINUITY-SEQUENCE:2\n") {
		t.Errorf("two discontinuities slid out: DISCONTINUITY-SEQUENCE must be 2:\n%s", out)
	}
	if strings.Contains(out, "#EXT-X-DISCONTINUITY\n") {
		t.Errorf("no discontinuity inside the window:\n%s", out)
	}
	inside := string(WindowPlaylist([]byte(full), 10)) // keeps 10 to 19: the one before 12 is inside
	if !strings.Contains(inside, "#EXT-X-DISCONTINUITY-SEQUENCE:1\n") || strings.Count(inside, "#EXT-X-DISCONTINUITY\n") != 1 {
		t.Errorf("one slid out (sequence 1) and one is still inside the window:\n%s", inside)
	}
	if i := strings.Index(inside, "#EXT-X-DISCONTINUITY\n"); i < 0 || !strings.HasPrefix(inside[i:], "#EXT-X-DISCONTINUITY\n#EXTINF:2.000000,\nsegment_012.ts") {
		t.Errorf("the tag must stay right before its segment:\n%s", inside)
	}
}

func TestAFinishedPlaylistIsServedWhole(t *testing.T) {
	full := eventPlaylist(25, true)
	if got := string(WindowPlaylist([]byte(full), 10)); got != full {
		t.Error("a playlist with ENDLIST is complete (replay): it must not be cut")
	}
}

func TestAPlaylistCaughtMidWriteIsReadUpToItsLastCompleteSegment(t *testing.T) {
	full := eventPlaylist(12, false)
	cut := full[:len(full)-len("ment_011.ts\n")-len("#EXTINF:2.000000,\nseg")] // ends inside the last segment's lines
	// a half-written last line (no newline) must not become a bogus segment
	half := cut + "#EXTINF:2.0"
	out := string(WindowPlaylist([]byte(half), 10))
	for _, s := range segmentsOf(out) {
		if !strings.HasPrefix(s, "segment_") || !strings.HasSuffix(s, ".ts") || len(s) != len("segment_000.ts") {
			t.Errorf("bogus segment %q in the window:\n%s", s, out)
		}
	}
	if len(segmentsOf(out)) == 0 {
		t.Error("the complete segments before the cut must still be served")
	}
}

func TestConfigurationOfTheWindowAndTheJanitorFailsFast(t *testing.T) {
	for name, env := range map[string]map[string]string{
		"window too small":    {"HLS_LIVE_WINDOW": "2"},
		"window not a number": {"HLS_LIVE_WINDOW": "many"},
		"ttl zero":            {"HLS_ORPHAN_TTL_HOURS": "0"},
		"ttl negative":        {"HLS_ORPHAN_TTL_HOURS": "-4"},
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
}
