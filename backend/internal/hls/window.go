package hls

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
)

// A live viewer does not need the whole playlist. FFmpeg writes one EVENT playlist that grows for the
// whole live (the replay is built from it, so it must stay complete): ~300 KB after 3 hours, downloaded
// again every 2 s by every viewer, and iOS starts at its beginning. The live API serves a window of the
// last segments instead, computed from the complete file.

const (
	defaultLiveWindow = 10 // segments, i.e. ~20 s at 2 s per segment
	minLiveWindow     = 3  // players keep at least three target durations of margin
)

type segment struct {
	extinf        string // the "#EXTINF:…" line
	uri           string
	discontinuity bool // "#EXT-X-DISCONTINUITY" right before it
}

// WindowPlaylist turns the complete media playlist into a sliding live window of the last `keep` segments.
//
//   - A finished playlist (#EXT-X-ENDLIST) is returned unchanged.
//   - The window never declares PLAYLIST-TYPE (it is not append-only), carries the media sequence of its
//     first segment and the number of discontinuities that slid out, and starts near the live edge.
//   - A playlist caught while FFmpeg is writing it is read up to its last complete segment.
func WindowPlaylist(full []byte, keep int) []byte {
	if keep < minLiveWindow {
		keep = minLiveWindow
	}
	text := string(full)
	if strings.Contains(text, "#EXT-X-ENDLIST") {
		return full
	}

	var (
		version            = "3"
		target             = 0
		firstSeq           = 0
		discSeq            = 0
		independent        bool
		segments           []segment
		pendingInf         string
		pendingDiscontinue bool
	)
	lines := strings.Split(text, "\n")
	// The last line may be half written: ignore it unless the file ends with a newline.
	if !strings.HasSuffix(text, "\n") && len(lines) > 0 {
		lines = lines[:len(lines)-1]
	}
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		switch {
		case line == "" || line == "#EXTM3U":
		case strings.HasPrefix(line, "#EXT-X-VERSION:"):
			version = strings.TrimPrefix(line, "#EXT-X-VERSION:")
		case strings.HasPrefix(line, "#EXT-X-TARGETDURATION:"):
			target, _ = strconv.Atoi(strings.TrimPrefix(line, "#EXT-X-TARGETDURATION:"))
		case strings.HasPrefix(line, "#EXT-X-MEDIA-SEQUENCE:"):
			firstSeq, _ = strconv.Atoi(strings.TrimPrefix(line, "#EXT-X-MEDIA-SEQUENCE:"))
		case strings.HasPrefix(line, "#EXT-X-DISCONTINUITY-SEQUENCE:"):
			discSeq, _ = strconv.Atoi(strings.TrimPrefix(line, "#EXT-X-DISCONTINUITY-SEQUENCE:"))
		case line == "#EXT-X-INDEPENDENT-SEGMENTS":
			independent = true
		case line == "#EXT-X-DISCONTINUITY":
			pendingDiscontinue = true
		case strings.HasPrefix(line, "#EXTINF:"):
			pendingInf = line
		case strings.HasPrefix(line, "#"):
			// PLAYLIST-TYPE, START, … : not carried over
		default: // a segment URI
			if pendingInf == "" {
				continue
			}
			segments = append(segments, segment{extinf: pendingInf, uri: line, discontinuity: pendingDiscontinue})
			pendingInf, pendingDiscontinue = "", false
		}
	}

	dropped := 0
	if len(segments) > keep {
		dropped = len(segments) - keep
		for _, s := range segments[:dropped] {
			if s.discontinuity {
				discSeq++
			}
		}
		segments = segments[dropped:]
	}
	if target == 0 { // no TARGETDURATION yet (the file is brand new): the muxer's -hls_time
		target = 2
	}

	var b bytes.Buffer
	b.WriteString("#EXTM3U\n")
	fmt.Fprintf(&b, "#EXT-X-VERSION:%s\n", version)
	fmt.Fprintf(&b, "#EXT-X-TARGETDURATION:%d\n", target)
	fmt.Fprintf(&b, "#EXT-X-MEDIA-SEQUENCE:%d\n", firstSeq+dropped)
	if discSeq > 0 {
		fmt.Fprintf(&b, "#EXT-X-DISCONTINUITY-SEQUENCE:%d\n", discSeq)
	}
	if independent {
		b.WriteString("#EXT-X-INDEPENDENT-SEGMENTS\n")
	}
	if len(segments) > 0 {
		// Start three target durations from the end, like players do for a live stream, but explicitly
		// (iOS starts at the beginning of an EVENT playlist otherwise).
		fmt.Fprintf(&b, "#EXT-X-START:TIME-OFFSET=-%d.0,PRECISE=NO\n", 3*target)
	}
	for _, s := range segments {
		if s.discontinuity {
			b.WriteString("#EXT-X-DISCONTINUITY\n")
		}
		b.WriteString(s.extinf + "\n" + s.uri + "\n")
	}
	return b.Bytes()
}
