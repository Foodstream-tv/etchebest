package hls

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// HLSWriter holds the UDP connections for writing RTP audio/video data to FFmpeg.
type HLSWriter struct {
	AudioConn net.Conn
	VideoConn net.Conn
}

// CodecInfo describes the negotiated codec for one media stream.
type CodecInfo struct {
	PayloadType uint8
	CodecName   string // e.g. "opus", "VP8", "H264"
	ClockRate   uint32
	Channels    uint16 // only for audio
	FmtpLine    string // optional, e.g. "minptime=10;useinbandfec=1"
}

// getFreePort finds a free UDP port by briefly binding then closing.
func getFreePort() (int, error) {
	addr, err := net.ResolveUDPAddr("udp4", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	l, err := net.ListenUDP("udp4", addr)
	if err != nil {
		return 0, err
	}
	port := l.LocalAddr().(*net.UDPAddr).Port
	l.Close()
	return port, nil
}

// buildSDP builds a minimal SDP string for FFmpeg with the given codecs and ports.
func buildSDP(audioPort int, audio *CodecInfo, videoPort int, video *CodecInfo) string {
	sdp := "v=0\n"
	sdp += "o=- 0 0 IN IP4 127.0.0.1\n"
	sdp += "s=WebRTC to HLS\n"
	sdp += "c=IN IP4 127.0.0.1\n"
	sdp += "t=0 0\n"

	if audio != nil {
		channels := ""
		if audio.Channels > 1 {
			channels = fmt.Sprintf("/%d", audio.Channels)
		}
		sdp += fmt.Sprintf("m=audio %d RTP/AVP %d\n", audioPort, audio.PayloadType)
		sdp += fmt.Sprintf("a=rtpmap:%d %s/%d%s\n", audio.PayloadType, audio.CodecName, audio.ClockRate, channels)
		if audio.FmtpLine != "" {
			sdp += fmt.Sprintf("a=fmtp:%d %s\n", audio.PayloadType, audio.FmtpLine)
		}
	}

	if video != nil {
		sdp += fmt.Sprintf("m=video %d RTP/AVP %d\n", videoPort, video.PayloadType)
		sdp += fmt.Sprintf("a=rtpmap:%d %s/%d\n", video.PayloadType, video.CodecName, video.ClockRate)
		if video.FmtpLine != "" {
			sdp += fmt.Sprintf("a=fmtp:%d %s\n", video.PayloadType, video.FmtpLine)
		}
	}

	return sdp
}

// Start launches an FFmpeg process that reads RTP audio+video from two local
// UDP ports and produces an HLS stream.  It returns an HLSWriter so callers
// can push RTP packets, and a stop function to tear everything down.
func Start(roomID string, audio *CodecInfo, video *CodecInfo) (*HLSWriter, func(), error) {
	hlsDir := "./hls/" + roomID
	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		return nil, nil, err
	}

	// ---- pick two free UDP ports ----
	audioPort, err := getFreePort()
	if err != nil {
		return nil, nil, fmt.Errorf("find audio port: %w", err)
	}
	videoPort, err := getFreePort()
	if err != nil {
		return nil, nil, fmt.Errorf("find video port: %w", err)
	}

	log.Printf("[HLS] audio UDP port=%d  video UDP port=%d  audio_codec=%v video_codec=%v",
		audioPort, videoPort,
		codecSummary(audio), codecSummary(video))

	// ---- write SDP file for FFmpeg ----
	sdpContent := buildSDP(audioPort, audio, videoPort, video)
	sdpPath := filepath.Join(hlsDir, "stream.sdp")
	if err := os.WriteFile(sdpPath, []byte(sdpContent), 0644); err != nil {
		return nil, nil, fmt.Errorf("write sdp: %w", err)
	}
	log.Printf("[HLS] SDP written to %s:\n%s", sdpPath, sdpContent)

	// ---- launch FFmpeg (it will bind the UDP ports from the SDP) ----
	cmd := exec.Command(
		"ffmpeg",
		"-loglevel", "warning",
		"-fflags", "+genpts",
		"-analyzeduration", "10000000", // 10 seconds – give FFmpeg time to detect VP8 frame size
		"-probesize", "5000000", // 5 MB probe
		"-protocol_whitelist", "file,udp,rtp",
		"-i", sdpPath,
		// audio → aac
		"-c:a", "aac",
		"-b:a", "128k",
		"-ar", "48000",
		"-ac", "2",
		// video → h264
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-g", "30",
		"-sc_threshold", "0",
		"-b:v", "1500k",
		"-maxrate", "1500k",
		"-bufsize", "3000k",
		"-pix_fmt", "yuv420p",
		// HLS output
		"-f", "hls",
		"-hls_time", "2",
		"-hls_list_size", "5",
		"-hls_flags", "delete_segments",
		filepath.Join(hlsDir, "index.m3u8"),
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return nil, nil, fmt.Errorf("start ffmpeg: %w", err)
	}
	log.Printf("[HLS] FFmpeg started (PID %d) for room %s", cmd.Process.Pid, roomID)

	// Give FFmpeg a moment to bind the UDP ports from the SDP before we
	// start sending packets. Without this, the initial keyframes can be
	// lost and FFmpeg never detects the video stream parameters.
	time.Sleep(500 * time.Millisecond)

	audioConn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", audioPort))
	if err != nil {
		cmd.Process.Kill()
		return nil, nil, fmt.Errorf("dial audio udp: %w", err)
	}
	videoConn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", videoPort))
	if err != nil {
		audioConn.Close()
		cmd.Process.Kill()
		return nil, nil, fmt.Errorf("dial video udp: %w", err)
	}

	stop := func() {
		audioConn.Close()
		videoConn.Close()
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	}

	RegisterToStream(roomID, stop)

	return &HLSWriter{AudioConn: audioConn, VideoConn: videoConn}, stop, nil
}

func codecSummary(c *CodecInfo) string {
	if c == nil {
		return "<nil>"
	}
	return fmt.Sprintf("PT=%d %s/%d", c.PayloadType, c.CodecName, c.ClockRate)
}
