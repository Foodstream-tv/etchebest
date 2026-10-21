package hls

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Real SPS captured from libx264 (High 4:4:4 Predictive, so the chroma_format_idc = 3 path).
var x264SPS = []struct{ size, hex string }{
	{"1920x1080", "67 f4 00 28 91 96 80 78 02 27 e2 70 11 00 00 03 00 01 00 00 03 00 3c 0f 18 32 a0"},
	{"1280x720", "67 f4 00 1f 91 96 80 50 05 bb 01 10 00 00 03 00 10 00 00 03 03 c0 f1 83 2a"},
	{"720x1280", "67 f4 00 1f 91 96 80 b4 0a 1b 01 10 00 00 03 00 10 00 00 03 03 c0 f1 83 2a"},
	{"854x480", "67 f4 00 1f 91 96 80 d8 3d e2 fc 04 40 00 00 03 00 40 00 00 0f 03 c6 0c a8"},
	{"640x360", "67 f4 00 1e 91 96 80 a0 2f f8 9c 04 40 00 00 03 00 40 00 00 0f 03 c5 8b a8"},
	{"1080x1920", "67 f4 00 28 91 96 80 44 03 c7 89 f0 11 00 00 03 00 01 00 00 03 00 3c 0f 18 32 a0"},
	{"721x1281", "67 f4 00 20 91 96 80 b8 0a 3e 10 84 30 11 00 00 03 00 01 00 00 03 00 3c 0f 18 32 a0"},
}

func mustHex(t *testing.T, s string) []byte {
	t.Helper()
	b, err := hex.DecodeString(strings.ReplaceAll(s, " ", ""))
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestParseSPSSizeOnRealX264Streams(t *testing.T) {
	for _, v := range x264SPS {
		var w, h int
		fmt.Sscanf(v.size, "%dx%d", &w, &h)
		gw, gh, err := ParseSPSSize(mustHex(t, v.hex))
		if err != nil || gw != w || gh != h {
			t.Errorf("%s: parsed %dx%d, %v", v.size, gw, gh, err)
		}
	}
}

// annexBSPS returns the SPS NAL unit of an Annex B stream.
func annexBSPS(stream []byte) []byte {
	start := []byte{0, 0, 1}
	for i := 0; i+3 < len(stream); i++ {
		if !bytes.HasPrefix(stream[i:], start) {
			continue
		}
		nal := stream[i+3:]
		if len(nal) > 0 && nal[0]&0x1f == 7 {
			end := len(nal)
			if j := bytes.Index(nal, []byte{0, 0, 1}); j >= 0 {
				end = j
			}
			return bytes.TrimRight(nal[:end], "\x00")
		}
	}
	return nil
}

func TestParseSPSSizeOnBaselineStreamsFromAnEncoder(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	out := filepath.Join(t.TempDir(), "o.h264")
	for _, size := range [][2]int{{1920, 1080}, {1280, 720}, {720, 1280}, {854, 480}, {480, 854}, {640, 360}, {360, 640}, {1080, 1920}} {
		cmd := exec.Command("ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", fmt.Sprintf("testsrc=size=%dx%d:rate=30", size[0], size[1]),
			"-frames:v", "1", "-pix_fmt", "yuv420p", "-c:v", "libopenh264", "-f", "h264", out)
		if msg, err := cmd.CombinedOutput(); err != nil {
			t.Skipf("no usable H.264 encoder here: %v %s", err, msg)
		}
		stream, _ := os.ReadFile(out)
		sps := annexBSPS(stream)
		if sps == nil {
			t.Fatalf("%dx%d: no SPS in the stream", size[0], size[1])
		}
		w, h, err := ParseSPSSize(sps)
		if err != nil || w != size[0] || h != size[1] {
			t.Errorf("%dx%d: parsed %dx%d, %v (cropping must be applied: 1080 is coded as 1088)", size[0], size[1], w, h, err)
		}
	}
}

func TestExtractSPSFromRTPPayloads(t *testing.T) {
	sps := mustHex(t, x264SPS[1].hex)
	pps := []byte{0x68, 0xce, 0x0f, 0x19, 0x20}

	if got := ExtractSPS(sps); !bytes.Equal(got, sps) {
		t.Error("a single-NAL payload carrying an SPS must be returned as is")
	}
	if ExtractSPS(pps) != nil {
		t.Error("a PPS is not an SPS")
	}

	// STAP-A: header, then [size][NAL] units: SPS and PPS aggregated
	stap := []byte{0x78}
	for _, nal := range [][]byte{sps, pps} {
		stap = append(stap, byte(len(nal)>>8), byte(len(nal)))
		stap = append(stap, nal...)
	}
	if got := ExtractSPS(stap); !bytes.Equal(got, sps) {
		t.Error("the SPS must be found inside a STAP-A")
	}
	// PPS first, SPS second
	stap2 := []byte{0x78, 0, byte(len(pps))}
	stap2 = append(stap2, pps...)
	stap2 = append(stap2, byte(len(sps)>>8), byte(len(sps)))
	stap2 = append(stap2, sps...)
	if got := ExtractSPS(stap2); !bytes.Equal(got, sps) {
		t.Error("the SPS must be found after another NAL in a STAP-A")
	}

	for name, bad := range map[string][]byte{
		"empty":            nil,
		"a slice":          {0x41, 1, 2, 3},
		"truncated STAP-A": {0x78, 0x00, 0x20, 0x67},
		"zero-size unit":   {0x78, 0x00, 0x00},
	} {
		if ExtractSPS(bad) != nil {
			t.Errorf("%s: must give nil", name)
		}
	}
}

func TestParseSPSSizeRefusesGarbageWithoutPanicking(t *testing.T) {
	for name, nal := range map[string][]byte{
		"not an SPS": {0x68, 1, 2, 3, 4, 5},
		"too short":  {0x67, 0x42},
		"all zeros":  append([]byte{0x67}, make([]byte, 16)...),
		"all ones":   append([]byte{0x67}, bytes.Repeat([]byte{0xff}, 16)...),
	} {
		if _, _, err := ParseSPSSize(nal); err == nil {
			t.Errorf("%s: must be refused", name)
		}
	}
	sps := mustHex(t, x264SPS[0].hex)
	for i := 1; i < len(sps); i++ { // any truncation is safe
		_, _, _ = ParseSPSSize(sps[:i])
	}
}

func TestForSourceDropsRenditionsTheSourceCannotFill(t *testing.T) {
	names := func(l Ladder) string {
		var n []string
		for _, r := range l.Rungs {
			n = append(n, r.Name)
		}
		return strings.Join(n, ",")
	}
	cases := []struct {
		w, h  int
		full  string
		light string
	}{
		{1920, 1080, "1080p,720p,480p,360p", "480p,360p"},
		{1280, 720, "720p,480p,360p", "480p,360p"},
		{720, 1280, "720p,480p,360p", "480p,360p"}, // portrait: the short side counts
		{854, 480, "480p,360p", "480p,360p"},
		{640, 360, "360p", "360p"},
		{320, 240, "360p", "360p"},                  // tiny: encoded once, never enlarged (the scale filter caps it)
		{0, 0, "1080p,720p,480p,360p", "480p,360p"}, // unknown source: nothing dropped
	}
	for _, c := range cases {
		if got := names(FullLadder.ForSource(c.w, c.h)); got != c.full {
			t.Errorf("%dx%d full ladder: %s, want %s", c.w, c.h, got, c.full)
		}
		if got := names(LightLadder.ForSource(c.w, c.h)); got != c.light {
			t.Errorf("%dx%d light ladder: %s, want %s", c.w, c.h, got, c.light)
		}
	}
}
