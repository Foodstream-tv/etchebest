package hls

import (
	"fmt"
	"strings"
)

// Rung is one rendition of the adaptive ladder. Short is the length of the SHORT side of the picture
// (so 720p means 1280x720 for a landscape source and 720x1280 for a portrait one, like YouTube).
type Rung struct {
	Name      string
	Short     int
	VideoKbps int
	MaxKbps   int
	BufKbps   int
	Level     string
	AudioKbps int
}

// Ladder is the set of renditions encoded for a live.
type Ladder struct {
	Name  string
	Rungs []Rung
}

var allRungs = []Rung{
	{Name: "1080p", Short: 1080, VideoKbps: 5000, MaxKbps: 5500, BufKbps: 10000, Level: "4.2", AudioKbps: 128},
	{Name: "720p", Short: 720, VideoKbps: 2800, MaxKbps: 3200, BufKbps: 5600, Level: "4.0", AudioKbps: 128},
	{Name: "480p", Short: 480, VideoKbps: 1200, MaxKbps: 1400, BufKbps: 2400, Level: "3.1", AudioKbps: 96},
	{Name: "360p", Short: 360, VideoKbps: 700, MaxKbps: 900, BufKbps: 1400, Level: "3.0", AudioKbps: 64},
}

var (
	// FullLadder is the normal case: four renditions.
	FullLadder = Ladder{Name: "full", Rungs: allRungs}
	// LightLadder is used when the server is already busy: two cheap renditions, so one more live does
	// not take the CPU the media server needs (4 x264 encodes cost about twice as much as 2).
	LightLadder = Ladder{Name: "light", Rungs: allRungs[2:]}
)

// qualityNames lists every rendition directory a live can have (some are absent in the light ladder).
func qualityNames() []string {
	names := make([]string, 0, len(allRungs))
	for _, r := range allRungs {
		names = append(names, r.Name)
	}
	return names
}

// scaleFilter scales to the rung without padding and without enlarging: the short side becomes
// min(rung, source short side), the other side follows the aspect ratio (even, as x264 requires). A
// portrait phone stream stays portrait in every rendition instead of being letterboxed into 16:9.
func scaleFilter(short int) string {
	// Landscape (iw > ih): height = min(short, ih), width follows. Portrait or square: width =
	// min(short, iw), height follows. trunc(x/2)*2 keeps a capped side even.
	return fmt.Sprintf(
		"scale=w='if(gt(iw,ih),-2,trunc(min(%[1]d,iw)/2)*2)':h='if(gt(iw,ih),trunc(min(%[1]d,ih)/2)*2,-2)'",
		short)
}

// filterGraph is the -filter_complex of the ladder: one decode, one fps conversion, N scalings.
func (l Ladder) filterGraph() string {
	n := len(l.Rungs)
	labels := make([]string, n)
	for i := range labels {
		labels[i] = fmt.Sprintf("[v%d]", i)
	}
	parts := []string{fmt.Sprintf("[0:v]fps=30,split=%d%s", n, strings.Join(labels, ""))}
	for i, r := range l.Rungs {
		parts = append(parts, fmt.Sprintf("[v%d]%s[v%dout]", i, scaleFilter(r.Short), i))
	}
	return strings.Join(parts, ";")
}

func (l Ladder) varStreamMap() string {
	entries := make([]string, len(l.Rungs))
	for i, r := range l.Rungs {
		entries[i] = fmt.Sprintf("v:%d,a:%d,name:%s", i, i, r.Name)
	}
	return strings.Join(entries, " ")
}

// outputArgs are the per-rendition encoder options.
func (l Ladder) outputArgs() []string {
	var args []string
	for i, r := range l.Rungs {
		args = append(args,
			"-map", fmt.Sprintf("[v%dout]", i),
			"-map", "0:a?",
			fmt.Sprintf("-c:v:%d", i), "libx264",
			fmt.Sprintf("-preset:v:%d", i), "veryfast",
			fmt.Sprintf("-tune:v:%d", i), "zerolatency",
			fmt.Sprintf("-b:v:%d", i), fmt.Sprintf("%dk", r.VideoKbps),
			fmt.Sprintf("-maxrate:v:%d", i), fmt.Sprintf("%dk", r.MaxKbps),
			fmt.Sprintf("-bufsize:v:%d", i), fmt.Sprintf("%dk", r.BufKbps),
			fmt.Sprintf("-g:v:%d", i), "30",
			fmt.Sprintf("-keyint_min:v:%d", i), "30",
			fmt.Sprintf("-sc_threshold:v:%d", i), "0",
			fmt.Sprintf("-level:v:%d", i), r.Level,
			fmt.Sprintf("-c:a:%d", i), "aac",
			fmt.Sprintf("-b:a:%d", i), fmt.Sprintf("%dk", r.AudioKbps),
		)
	}
	return args
}

// ForSource keeps only the renditions the source can fill: a rung whose short side is above the
// source's would be the same picture encoded again at a higher bitrate. At least the smallest rung is
// kept (a tiny source is encoded once). An unknown source (0x0) keeps the whole ladder.
func (l Ladder) ForSource(width, height int) Ladder {
	if width <= 0 || height <= 0 {
		return l
	}
	short := min(width, height)
	var kept []Rung
	for _, r := range l.Rungs {
		if r.Short <= short {
			kept = append(kept, r)
		}
	}
	if len(kept) == 0 {
		kept = []Rung{l.Rungs[len(l.Rungs)-1]}
	}
	return Ladder{Name: l.Name, Rungs: kept}
}
