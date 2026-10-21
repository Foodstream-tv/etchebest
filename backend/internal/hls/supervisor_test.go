package hls

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

// TestHelperProcess is not a test: it is the stand-in for FFmpeg (see fakeFFmpeg). It binds the two
// UDP ports of the SDP like FFmpeg does, records its run, then behaves as HELPER_MODE says.
func TestHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_FFMPEG") != "1" {
		return
	}
	args := strings.Split(os.Getenv("HELPER_ARGS"), "\x1f")
	dir := os.Getenv("HELPER_DIR")
	mode := os.Getenv("HELPER_MODE")

	var sdpPath string
	for i, a := range args {
		if a == "-i" && i+1 < len(args) {
			sdpPath = args[i+1]
		}
	}
	sdp, err := os.ReadFile(sdpPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "no sdp:", err)
		os.Exit(2)
	}
	if mode == "exit-at-once" {
		fmt.Fprintln(os.Stderr, "fake ffmpeg: cannot open input")
		os.Exit(1)
	}
	for _, m := range regexp.MustCompile(`m=(?:audio|video) (\d+)`).FindAllStringSubmatch(string(sdp), -1) {
		port, _ := strconv.Atoi(m[1])
		conn, err := listenUDP(port)
		if err != nil {
			fmt.Fprintln(os.Stderr, "bind:", err)
			os.Exit(3)
		}
		defer conn.Close()
	}

	n := 1
	for {
		if _, err := os.Stat(filepath.Join(dir, fmt.Sprintf("run-%d", n))); err != nil {
			break
		}
		n++
	}
	_ = os.WriteFile(filepath.Join(dir, fmt.Sprintf("run-%d", n)), []byte(strings.Join(args, " ")), 0644)
	_ = os.WriteFile(filepath.Join(dir, fmt.Sprintf("pid-%d", n)), []byte(strconv.Itoa(os.Getpid())), 0644)

	switch {
	case mode == "crash-always", mode == "crash-first" && n == 1:
		time.Sleep(150 * time.Millisecond)
		fmt.Fprintf(os.Stderr, "fake ffmpeg: Conversion failed! (run %d)\n", n)
		os.Exit(1)
	case mode == "stubborn":
		signal.Ignore(syscall.SIGTERM)
		select {} // ignores 'q' and SIGTERM: only a kill ends it
	}

	// healthy: run until told to quit
	buf := make([]byte, 16)
	for {
		k, err := os.Stdin.Read(buf)
		if strings.Contains(string(buf[:k]), "q") || err != nil {
			os.Exit(0)
		}
	}
}

// fakeFFmpeg makes the supervisor start this test binary instead of FFmpeg.
func fakeFFmpeg(t *testing.T, mode string) (stateDir string) {
	t.Helper()
	stateDir = t.TempDir()
	prev := ffmpegCommand
	t.Cleanup(func() { ffmpegCommand = prev })
	ffmpegCommand = func(args []string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=^TestHelperProcess$")
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_FFMPEG=1", "HELPER_MODE="+mode, "HELPER_DIR="+stateDir, "HELPER_ARGS="+strings.Join(args, "\x1f"))
		return cmd
	}
	return stateDir
}

func fastTimings(t *testing.T) {
	t.Helper()
	b, m, h, g, s := bindTimeout, maxBackoff, restartBackoffBase, gracefulStopWait, termStopWait
	hl := healthyAfter
	t.Cleanup(func() {
		bindTimeout, maxBackoff, restartBackoffBase, gracefulStopWait, termStopWait, healthyAfter = b, m, h, g, s, hl
	})
	bindTimeout, maxBackoff, restartBackoffBase = 3*time.Second, 20*time.Millisecond, 5*time.Millisecond
	gracefulStopWait, termStopWait = 300*time.Millisecond, 300*time.Millisecond
	t.Setenv("HLS_RTP_PORT_MIN", "41000")
	t.Setenv("HLS_RTP_PORT_MAX", "41099")
	t.Chdir(t.TempDir()) // Start writes into ./hls
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func exists(path string) bool { _, err := os.Stat(path); return err == nil }

func alive(pid int) bool { return syscall.Kill(pid, 0) == nil }

func readPID(t *testing.T, dir string, n int) int {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, fmt.Sprintf("pid-%d", n)))
	if err != nil {
		t.Fatal(err)
	}
	pid, _ := strconv.Atoi(string(b))
	return pid
}

var testCodecs = func() (*CodecInfo, *CodecInfo) {
	return &CodecInfo{PayloadType: 111, CodecName: "opus", ClockRate: 48000, Channels: 2},
		&CodecInfo{PayloadType: 96, CodecName: "H264", ClockRate: 90000}
}

func TestACrashedFFmpegIsRestartedAndAppendsToThePlaylists(t *testing.T) {
	fastTimings(t)
	dir := fakeFFmpeg(t, "crash-first")
	audio, video := testCodecs()

	writer, stop, err := Start("room-crash", audio, video)
	if err != nil {
		t.Fatal(err)
	}
	var restarts atomic.Int32
	writer.SetOnRestart(func() { restarts.Add(1) })

	waitFor(t, "FFmpeg to be relaunched after its crash", func() bool { return exists(filepath.Join(dir, "run-2")) })
	waitFor(t, "the pipeline to report running again", func() bool { return writer.Status() == StatusRunning })
	waitFor(t, "the keyframe callback", func() bool { return restarts.Load() == 1 })

	first, _ := os.ReadFile(filepath.Join(dir, "run-1"))
	second, _ := os.ReadFile(filepath.Join(dir, "run-2"))
	if strings.Contains(string(first), "discont_start") {
		t.Error("the first run must not announce a discontinuity")
	}
	if !strings.Contains(string(second), "append_list+independent_segments+discont_start") {
		t.Errorf("the restart must append to the playlists with a discontinuity: %s", second)
	}
	if got := StatusOf("room-crash"); got != StatusRunning {
		t.Errorf("StatusOf = %q, want running", got)
	}

	// the relay's sockets are still the right ones: writing does not fail
	if _, err := writer.VideoConn.Write([]byte("rtp")); err != nil {
		t.Errorf("the video socket must survive the restart: %v", err)
	}

	pid := readPID(t, dir, 2)
	stop()
	waitFor(t, "no FFmpeg left after stop", func() bool { return !alive(pid) })
	stop() // idempotent
}

func TestFFmpegGivesUpWhenItKeepsCrashing(t *testing.T) {
	fastTimings(t)
	fakeFFmpeg(t, "crash-always")
	audio, video := testCodecs()

	writer, stop, err := Start("room-giveup", audio, video)
	if err != nil {
		t.Fatal(err)
	}
	defer stop()
	waitFor(t, "the pipeline to be declared unavailable", func() bool { return writer.Status() == StatusUnavailable })
}

func TestStartFailsCleanlyWhenFFmpegCannotRun(t *testing.T) {
	fastTimings(t)
	fakeFFmpeg(t, "exit-at-once")
	audio, video := testCodecs()

	if _, _, err := Start("room-dead", audio, video); err == nil {
		t.Fatal("Start must fail when FFmpeg dies at once")
	} else if !strings.Contains(err.Error(), "cannot open input") {
		t.Errorf("the error must carry FFmpeg's last words: %v", err)
	}
	portsMu.Lock()
	left := len(portsUsed)
	portsMu.Unlock()
	if left != 0 {
		t.Errorf("%d port(s) still reserved after a failed start", left)
	}
	if StatusOf("room-dead") != "" || IsRunning("room-dead") {
		t.Error("a failed start must not register a stream")
	}
}

func TestAStubbornFFmpegIsKilled(t *testing.T) {
	fastTimings(t)
	dir := fakeFFmpeg(t, "stubborn")
	audio, video := testCodecs()

	_, stop, err := Start("room-stubborn", audio, video)
	if err != nil {
		t.Fatal(err)
	}
	pid := readPID(t, dir, 1)
	stop()
	waitFor(t, "the stubborn process to be killed", func() bool { return !alive(pid) })
}

func TestRTPPortsComeFromTheDedicatedRangeAndAreExclusive(t *testing.T) {
	t.Setenv("HLS_RTP_PORT_MIN", "42000")
	t.Setenv("HLS_RTP_PORT_MAX", "42015") // 8 pairs
	var all []int
	for i := 0; i < 4; i++ {
		a, v, err := allocateRTPPorts()
		if err != nil {
			t.Fatal(err)
		}
		all = append(all, a, v)
	}
	seen := map[int]bool{}
	for _, p := range all {
		if p < 42000 || p+1 > 42015 || p%2 != 0 {
			t.Errorf("port %d outside the range or not an RTP (even) port", p)
		}
		if seen[p] {
			t.Errorf("port %d handed out twice", p)
		}
		seen[p] = true
	}
	if _, _, err := allocateRTPPorts(); err == nil {
		t.Error("a 9th pair must not exist in a range of 8")
	}
	releasePorts(all...)
	if _, _, err := allocateRTPPorts(); err != nil {
		t.Errorf("released ports must be reusable: %v", err)
	}
}

func TestPortRangeConfigurationFailsFast(t *testing.T) {
	for name, env := range map[string]map[string]string{
		"not a number": {"HLS_RTP_PORT_MIN": "abc"},
		"too small":    {"HLS_RTP_PORT_MIN": "40000", "HLS_RTP_PORT_MAX": "40001"},
		"inverted":     {"HLS_RTP_PORT_MIN": "40100", "HLS_RTP_PORT_MAX": "40000"},
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

func TestTailBufferKeepsTheLastWords(t *testing.T) {
	tb := &tailBuffer{}
	tb.Write([]byte(strings.Repeat("x", stderrTailBytes)))
	tb.Write([]byte("the end"))
	if got := tb.String(); !strings.HasSuffix(got, "the end") || len(got) > stderrTailBytes {
		t.Errorf("tail = %d bytes ending %q", len(got), got[max(0, len(got)-10):])
	}
}
