package hls

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

// Status is the health of a room's HLS pipeline.
type Status string

const (
	StatusStarting    Status = "starting"
	StatusRunning     Status = "running"
	StatusRestarting  Status = "restarting"
	StatusUnavailable Status = "unavailable" // FFmpeg keeps dying: the live goes on over WebRTC without HLS
)

const (
	maxRestartFailures = 8
	stderrTailBytes    = 4096
)

// Timings; variables so the tests do not have to wait for real seconds.
var (
	bindTimeout        = 8 * time.Second
	healthyAfter       = 30 * time.Second // a process that lived this long resets the failure count
	restartBackoffBase = time.Second
	maxBackoff         = 15 * time.Second
	gracefulStopWait   = 5 * time.Second // after "q"
	termStopWait       = 3 * time.Second // after SIGTERM, then kill
)

// ffmpegCommand builds the FFmpeg process; replaced in tests by a stand-in.
var ffmpegCommand = func(args []string) *exec.Cmd { return exec.Command("ffmpeg", args...) }

// tailBuffer keeps the last bytes written to it: FFmpeg's last words are what explains a crash.
type tailBuffer struct {
	mu  sync.Mutex
	buf []byte
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	if len(t.buf) > stderrTailBytes {
		t.buf = t.buf[len(t.buf)-stderrTailBytes:]
	}
	return len(p), nil
}

func (t *tailBuffer) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(bytes.TrimSpace(t.buf))
}

// proc is one running FFmpeg process.
type proc struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stderr  *tailBuffer
	started time.Time
	done    chan struct{} // closed once Wait returned
	err     error         // Wait's result, valid after done
}

// supervisor keeps an FFmpeg process alive for a room: it notices a crash, restarts it on the same
// ports (the relay's UDP sockets stay valid) and appends to the existing playlists.
type supervisor struct {
	roomID    string
	sdpPath   string
	hlsDir    string
	audioPort int
	videoPort int

	mu        sync.Mutex
	cur       *proc
	state     Status
	onRestart func()

	stopCh   chan struct{}
	stopOnce sync.Once
	finished chan struct{}
}

func (s *supervisor) setState(st Status) {
	s.mu.Lock()
	s.state = st
	s.mu.Unlock()
}

func (s *supervisor) status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state
}

func (s *supervisor) setOnRestart(fn func()) {
	s.mu.Lock()
	s.onRestart = fn
	s.mu.Unlock()
}

func (s *supervisor) launch(restart bool) (*proc, error) {
	cmd := ffmpegCommand(buildFFmpegArgs(s.sdpPath, s.hlsDir, restart))
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("ffmpeg stdin pipe: %w", err)
	}
	tail := &tailBuffer{}
	cmd.Stdout = os.Stdout
	cmd.Stderr = io.MultiWriter(os.Stderr, tail)
	setProcAttr(cmd)

	if err := startCommand(cmd); err != nil {
		return nil, fmt.Errorf("start ffmpeg: %w", err)
	}
	p := &proc{cmd: cmd, stdin: stdin, stderr: tail, started: time.Now(), done: make(chan struct{})}
	go func() {
		p.err = cmd.Wait()
		close(p.done)
	}()

	s.mu.Lock()
	s.cur = p
	s.mu.Unlock()
	log.Printf("[HLS] FFmpeg started PID=%d room=%s restart=%v", cmd.Process.Pid, s.roomID, restart)
	return p, nil
}

// waitBound waits until FFmpeg has opened both UDP input ports (so the first keyframe is not sent
// into the void) or exits. It returns false if the process died or the wait timed out.
func (s *supervisor) waitBound(p *proc) bool {
	deadline := time.Now().Add(bindTimeout)
	for time.Now().Before(deadline) {
		select {
		case <-p.done:
			return false
		case <-s.stopCh:
			return false
		default:
		}
		if portOpen(s.audioPort) && portOpen(s.videoPort) {
			return true
		}
		time.Sleep(50 * time.Millisecond)
	}
	return false
}

// portOpen reports whether something listens on the loopback UDP port. It sends an empty datagram and
// looks for the "port unreachable" answer: unlike a test bind, it never holds the port itself, which
// would race with FFmpeg opening it.
func portOpen(port int) bool {
	conn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	defer conn.Close()
	if _, err := conn.Write(nil); err != nil {
		return false
	}
	_ = conn.SetReadDeadline(time.Now().Add(30 * time.Millisecond))
	_, err = conn.Read(make([]byte, 1))
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return true // nobody answered "unreachable": the port is open
	}
	return false
}

func backoffFor(failures int) time.Duration {
	d := restartBackoffBase << uint(failures-1)
	if d > maxBackoff || d <= 0 {
		return maxBackoff
	}
	return d
}

// run watches the current process; when it dies on its own it relaunches it, until stop.
func (s *supervisor) run(p *proc) {
	defer close(s.finished)
	failures := 0
	for {
		select {
		case <-s.stopCh:
			return
		case <-p.done:
		}

		lived := time.Since(p.started)
		log.Printf("[HLS] FFmpeg exited by itself after %v in room %s: %v\n--- last FFmpeg output ---\n%s\n--------------------------",
			lived.Round(time.Millisecond), s.roomID, p.err, p.stderr.String())
		if lived >= healthyAfter {
			failures = 0
		}
		s.setState(StatusRestarting)

		for {
			failures++
			if failures > maxRestartFailures {
				s.setState(StatusUnavailable)
				log.Printf("[HLS] giving up on FFmpeg for room %s after %d failed restarts: the live continues without HLS", s.roomID, maxRestartFailures)
				return
			}
			select {
			case <-s.stopCh:
				return
			case <-time.After(backoffFor(failures)):
			}
			np, err := s.launch(true)
			if err != nil {
				log.Printf("[HLS] cannot restart FFmpeg for room %s: %v", s.roomID, err)
				continue
			}
			p = np
			if s.waitBound(np) {
				s.setState(StatusRunning)
				s.mu.Lock()
				fn := s.onRestart
				s.mu.Unlock()
				if fn != nil {
					go fn()
				}
			}
			break // either running, or it died again: the outer loop notices through p.done
		}
	}
}

// stopProc asks FFmpeg to finish its segments ('q'), then insists (SIGTERM, then kill).
func stopProc(roomID string, p *proc) {
	if p == nil {
		return
	}
	select {
	case <-p.done:
		return
	default:
	}
	_, _ = p.stdin.Write([]byte("q\n"))
	_ = p.stdin.Close()

	select {
	case <-p.done:
		log.Printf("[HLS] ffmpeg stopped gracefully for room %s", roomID)
		return
	case <-time.After(gracefulStopWait):
	}
	log.Printf("[HLS] ffmpeg did not stop on 'q', sending SIGTERM (room %s)", roomID)
	_ = p.cmd.Process.Signal(syscall.SIGTERM)
	select {
	case <-p.done:
		return
	case <-time.After(termStopWait):
	}
	log.Printf("[HLS] ffmpeg did not stop on SIGTERM, killing it (room %s)", roomID)
	if err := p.cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		log.Printf("[HLS] failed to kill ffmpeg for room %s: %v", roomID, err)
	}
	<-p.done
}

// stop ends supervision and the current process. Safe to call several times.
func (s *supervisor) stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		<-s.finished
		s.mu.Lock()
		p := s.cur
		s.mu.Unlock()
		stopProc(s.roomID, p)
	})
}

// Start launches FFmpeg for the room and keeps it running: it reads RTP audio and video from two
// local UDP ports and produces an adaptive HLS stream. The returned writer feeds those ports.
func Start(roomID string, audio *CodecInfo, video *CodecInfo) (*HLSWriter, func(), error) {
	hlsDir := filepath.Join("./hls", roomID)
	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		return nil, nil, err
	}
	for _, quality := range []string{"1080p", "720p", "480p", "360p"} {
		if err := os.MkdirAll(filepath.Join(hlsDir, quality), 0755); err != nil {
			return nil, nil, err
		}
	}

	audioPort, videoPort, err := allocateRTPPorts()
	if err != nil {
		return nil, nil, fmt.Errorf("find RTP ports: %w", err)
	}
	release := func() { releasePorts(audioPort, videoPort) }

	log.Printf("[HLS] audio UDP port=%d video UDP port=%d audio_codec=%v video_codec=%v",
		audioPort, videoPort, codecSummary(audio), codecSummary(video))

	sdpPath := filepath.Join(hlsDir, "stream.sdp")
	if err := os.WriteFile(sdpPath, []byte(buildSDP(audioPort, audio, videoPort, video)), 0644); err != nil {
		release()
		return nil, nil, fmt.Errorf("write sdp: %w", err)
	}

	s := &supervisor{
		roomID: roomID, sdpPath: sdpPath, hlsDir: hlsDir,
		audioPort: audioPort, videoPort: videoPort,
		state:  StatusStarting,
		stopCh: make(chan struct{}), finished: make(chan struct{}),
	}

	// A room that already has playlists (the host came back) continues them.
	_, statErr := os.Stat(filepath.Join(hlsDir, "master.m3u8"))
	p, err := s.launch(statErr == nil)
	if err != nil {
		release()
		return nil, nil, err
	}
	if !s.waitBound(p) {
		stopProc(roomID, p)
		release()
		return nil, nil, fmt.Errorf("ffmpeg did not open its input ports (exited: %v): %s", p.err, p.stderr.String())
	}

	audioConn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", audioPort))
	if err != nil {
		stopProc(roomID, p)
		release()
		return nil, nil, fmt.Errorf("dial audio udp: %w", err)
	}
	videoConn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", videoPort))
	if err != nil {
		_ = audioConn.Close()
		stopProc(roomID, p)
		release()
		return nil, nil, fmt.Errorf("dial video udp: %w", err)
	}

	s.setState(StatusRunning)
	go s.run(p)

	stop := func() {
		_ = audioConn.Close()
		_ = videoConn.Close()
		s.stop()
		release()
	}
	RegisterToStream(roomID, stop, s.status)

	// Wait a moment for FFmpeg to create initial playlists, then log status
	go func() {
		time.Sleep(3 * time.Second)
		masterPath := filepath.Join("./hls", roomID, "master.m3u8")
		if data, err := os.ReadFile(masterPath); err == nil {
			log.Printf("[HLS] master.m3u8 created for room %s:\n%s", roomID, string(data))
		} else {
			log.Printf("[HLS] ERROR: master.m3u8 not found for room %s: %v", roomID, err)
		}
	}()

	return &HLSWriter{AudioConn: audioConn, VideoConn: videoConn, sup: s}, stop, nil
}
