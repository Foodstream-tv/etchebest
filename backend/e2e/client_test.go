//go:build e2e

// The publishers send real H264 + Opus over WebRTC: the Docker backend (with FFmpeg) is needed, and some
// tests restart it.
package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
	"github.com/pion/webrtc/v4/pkg/media/h264reader"
	"github.com/pion/webrtc/v4/pkg/media/oggreader"
)

const (
	container      = "backend-foodstream"
	dbContainer    = "db-foodstream"
	demoPassword   = "Demo1234!"
	hostEmail      = "demo.host@example.com"
	viewerEmail    = "demo.viewer@example.com"
	statusLive     = "live"
	statusEnded    = "ended"
	h264Fmtp       = "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f"
	frameDuration  = time.Second / 30
	opusPageLength = 20 * time.Millisecond
)

var (
	baseURL   = envOr("E2E_BASE_URL", "http://localhost:8081")
	mediaDir  string
	repoRoot  string
	startedAt time.Time
)

func envOr(name, def string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return def
}

func TestMain(m *testing.M) {
	startedAt = time.Now()
	wd, _ := os.Getwd()
	repoRoot = filepath.Dir(filepath.Dir(wd))
	dir, err := os.MkdirTemp("", "e2e-media")
	if err != nil {
		panic(err)
	}
	mediaDir = dir
	if err := makeMedia(); err != nil {
		fmt.Fprintln(os.Stderr, "e2e: cannot generate the test media with the container's FFmpeg:", err)
		os.Exit(1)
	}
	code := m.Run()
	reportBackendLogs()
	_ = os.RemoveAll(dir)
	os.Exit(code)
}

// makeMedia encodes 20 s of test picture and tone with the backend container's FFmpeg.
func makeMedia() error {
	steps := [][]string{
		{"exec", container, "ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
			"-t", "20", "-c:v", "libx264", "-profile:v", "baseline", "-level", "3.1", "-pix_fmt", "yuv420p",
			"-g", "30", "-bsf:v", "h264_mp4toannexb", "-f", "h264", "/tmp/e2e.h264"},
		{"exec", container, "ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440",
			"-t", "20", "-c:a", "libopus", "-page_duration", "20000", "-f", "ogg", "/tmp/e2e.ogg"},
		{"cp", container + ":/tmp/e2e.h264", filepath.Join(mediaDir, "e2e.h264")},
		{"cp", container + ":/tmp/e2e.ogg", filepath.Join(mediaDir, "e2e.ogg")},
	}
	for _, args := range steps {
		if out, err := exec.Command("docker", args...).CombinedOutput(); err != nil {
			return fmt.Errorf("docker %s: %v: %s", args[0], err, out)
		}
	}
	return nil
}

// --- HTTP API --------------------------------------------------------------------------------------

type account struct {
	token string
	id    string
}

func call(t *testing.T, method, path, token string, body any) (int, []byte) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, baseURL+path, reader)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, data
}

func decode(t *testing.T, data []byte, into any) {
	t.Helper()
	if err := json.Unmarshal(data, into); err != nil {
		t.Fatalf("decode %s: %v", data, err)
	}
}

func login(t *testing.T, email string) account {
	t.Helper()
	status, data := call(t, http.MethodPost, "/api/login", "", map[string]string{"email": email, "password": demoPassword})
	if status != http.StatusOK {
		t.Fatalf("login %s: %d %s (run make seed first)", email, status, data)
	}
	var tok struct{ Token string }
	decode(t, data, &tok)
	_, data = call(t, http.MethodGet, "/api/users/me", tok.Token, nil)
	var me struct{ ID string }
	decode(t, data, &me)
	return account{token: tok.Token, id: me.ID}
}

// endActiveLives ends whatever live or scheduled live the account still has, so a test starts clean.
func endActiveLives(t *testing.T, a account) {
	t.Helper()
	endLivesOf(t, a)
	t.Cleanup(func() { endLivesOf(t, a) })
}

func endLivesOf(t *testing.T, a account) {
	t.Helper()
	out := psql(t, fmt.Sprintf("select room_id from lives where user_id = '%s' and status in ('live','scheduled')", a.id))
	for roomID := range strings.FieldsSeq(out) {
		call(t, http.MethodPost, "/api/rooms/"+roomID+"/disconnect", a.token, nil)
	}
}

func createLive(t *testing.T, a account, status string, scheduledAt *time.Time) string {
	t.Helper()
	body := map[string]any{"name": "e2e " + t.Name(), "title": "e2e " + t.Name(), "status": status, "tags": []string{"Test"}}
	if scheduledAt != nil {
		body["scheduledAt"] = scheduledAt.UTC().Format(time.RFC3339)
	}
	code, data := call(t, http.MethodPost, "/api/rooms", a.token, body)
	if code != http.StatusOK {
		t.Fatalf("create live: %d %s", code, data)
	}
	var created struct{ RoomID string }
	decode(t, data, &created)
	return created.RoomID
}

type liveView struct {
	Status    string `json:"status"`
	HasReplay bool   `json:"has_replay"`
	ReplayURL string `json:"replay_url"`
}

func getLive(t *testing.T, roomID string) liveView {
	t.Helper()
	code, data := call(t, http.MethodGet, "/api/lives/"+roomID, "", nil)
	if code != http.StatusOK {
		t.Fatalf("get live %s: %d %s", roomID, code, data)
	}
	var l liveView
	decode(t, data, &l)
	return l
}

func waitForStatus(t *testing.T, roomID, status string, within time.Duration) time.Duration {
	t.Helper()
	start := time.Now()
	for getLive(t, roomID).Status != status {
		if time.Since(start) > within {
			t.Fatalf("live %s still %s after %s, want %s", roomID, getLive(t, roomID).Status, within, status)
		}
		time.Sleep(time.Second)
	}
	return time.Since(start)
}

// replaySegments counts the segments of the first rendition of a replay.
func replaySegments(t *testing.T, replayURL string) int {
	t.Helper()
	code, master := call(t, http.MethodGet, replayURL, "", nil)
	if code != http.StatusOK {
		t.Fatalf("replay master %s: %d", replayURL, code)
	}
	for line := range strings.SplitSeq(string(master), "\n") {
		if line = strings.TrimSpace(line); line != "" && !strings.HasPrefix(line, "#") {
			_, media := call(t, http.MethodGet, strings.TrimSuffix(replayURL, "master.m3u8")+line, "", nil)
			return strings.Count(string(media), "#EXTINF")
		}
	}
	return 0
}

// --- Docker ------------------------------------------------------------------------------------------

func psql(t *testing.T, query string) string {
	t.Helper()
	out, err := exec.Command("docker", "exec", dbContainer, "psql", "-U", "root", "-d", "foodstream", "-tAc", query).CombinedOutput()
	if err != nil {
		t.Fatalf("psql %q: %v: %s", query, err, out)
	}
	return string(out)
}

// restartBackend restarts the container like `docker compose restart backend` and returns the exit code
// of the stopped process.
func restartBackend(t *testing.T) string {
	t.Helper()
	since := time.Now()
	cmd := exec.Command("docker", "compose", "restart", "backend")
	cmd.Dir = repoRoot
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("docker compose restart: %v: %s", err, out)
	}
	waitHealthy(t)
	out, _ := exec.Command("docker", "events", "--since", since.Format(time.RFC3339Nano), "--until", time.Now().Format(time.RFC3339Nano),
		"--filter", "container="+container, "--filter", "event=die", "--format", "{{.Actor.Attributes.exitCode}}").Output()
	return strings.TrimSpace(string(out))
}

func waitHealthy(t *testing.T) {
	t.Helper()
	deadline := time.Now().Add(60 * time.Second)
	for time.Now().Before(deadline) {
		if resp, err := http.Get(baseURL + "/"); err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatal("the backend did not come back within 60 s")
}

// reportBackendLogs prints the suspicious lines the backend logged during the run.
func reportBackendLogs() {
	out, err := exec.Command("docker", "logs", "--since", startedAt.Format(time.RFC3339Nano), container).CombinedOutput()
	if err != nil {
		fmt.Println("e2e: cannot read the backend logs:", err)
		return
	}
	seen := map[string]bool{}
	fmt.Println("\n=== backend log lines worth a look ===")
	for line := range strings.SplitSeq(string(out), "\n") {
		lower := strings.ToLower(line)
		if !strings.Contains(lower, "panic") && !strings.Contains(lower, "error") && !strings.Contains(lower, "fail") &&
			!strings.Contains(lower, "nothing was encoded") {
			continue
		}
		key := line
		if len(key) > 20 {
			key = key[20:] // drop the timestamp so repeats collapse
		}
		if !seen[key] {
			seen[key] = true
			fmt.Println(line)
		}
	}
}

// --- WebRTC publisher -----------------------------------------------------------------------------------

type publisher struct {
	pc     *webrtc.PeerConnection
	cancel context.CancelFunc
}

func (p *publisher) close() {
	p.cancel()
	_ = p.pc.Close()
}

// errRefused is a join the server answered with an error status.
type errRefused struct {
	status int
	body   string
}

func (e errRefused) Error() string { return fmt.Sprintf("join refused: %d %s", e.status, e.body) }

// publish joins roomID as a: an offer with one H264 and one Opus track, then sends the test media in a loop.
func publish(t *testing.T, a account, roomID string) (*publisher, error) {
	t.Helper()
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	video, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264, ClockRate: 90000, SDPFmtpLine: h264Fmtp}, "video", "e2e-"+a.id)
	if err != nil {
		t.Fatal(err)
	}
	audio, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2}, "audio", "e2e-"+a.id)
	if err != nil {
		t.Fatal(err)
	}
	for _, track := range []webrtc.TrackLocal{video, audio} {
		sender, err := pc.AddTrack(track)
		if err != nil {
			t.Fatal(err)
		}
		go drainRTCP(sender)
	}
	connected := make(chan struct{})
	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		if s == webrtc.PeerConnectionStateConnected {
			close(connected)
		}
	})

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		t.Fatal(err)
	}
	<-gathered
	code, data := call(t, http.MethodPost, "/api/webrtc?roomId="+roomID, a.token, pc.LocalDescription())
	if code != http.StatusOK {
		_ = pc.Close()
		return nil, errRefused{code, string(data)}
	}
	var answer struct{ SDP string }
	decode(t, data, &answer)
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: answer.SDP}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-connected:
	case <-time.After(15 * time.Second):
		_ = pc.Close()
		t.Fatal("WebRTC did not connect within 15 s")
	}
	ctx, cancel := context.WithCancel(context.Background())
	go sendVideo(ctx, video)
	go sendAudio(ctx, audio)
	return &publisher{pc: pc, cancel: cancel}, nil
}

func mustPublish(t *testing.T, a account, roomID string) *publisher {
	t.Helper()
	p, err := publish(t, a, roomID)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.close)
	return p
}

func drainRTCP(sender *webrtc.RTPSender) {
	buf := make([]byte, 1500)
	for {
		if _, _, err := sender.Read(buf); err != nil {
			return
		}
	}
}

func sendVideo(ctx context.Context, track *webrtc.TrackLocalStaticSample) {
	ticker := time.NewTicker(frameDuration)
	defer ticker.Stop()
	for ctx.Err() == nil {
		file, err := os.Open(filepath.Join(mediaDir, "e2e.h264"))
		if err != nil {
			return
		}
		reader, err := h264reader.NewReader(file)
		for err == nil && ctx.Err() == nil {
			var nal *h264reader.NAL
			if nal, err = reader.NextNAL(); err == nil {
				<-ticker.C
				_ = track.WriteSample(media.Sample{Data: nal.Data, Duration: frameDuration})
			}
		}
		file.Close()
	}
}

func sendAudio(ctx context.Context, track *webrtc.TrackLocalStaticSample) {
	ticker := time.NewTicker(opusPageLength)
	defer ticker.Stop()
	for ctx.Err() == nil {
		file, err := os.Open(filepath.Join(mediaDir, "e2e.ogg"))
		if err != nil {
			return
		}
		reader, _, err := oggreader.NewWith(file)
		for err == nil && ctx.Err() == nil {
			var page []byte
			if page, _, err = reader.ParseNextPage(); err == nil && !bytes.HasPrefix(page, []byte("OpusTags")) {
				<-ticker.C
				_ = track.WriteSample(media.Sample{Data: page, Duration: opusPageLength})
			}
		}
		file.Close()
		if err != nil && !errors.Is(err, io.EOF) {
			return
		}
	}
}
