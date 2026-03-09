package hls

import (
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
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
	// Validate inputs
	if strings.TrimSpace(roomID) == "" {
		return nil, nil, errors.New("roomID cannot be empty")
	}
	if audio == nil && video == nil {
		return nil, nil, errors.New("at least one of audio or video must be provided")
	}

	// Normalize codec names to handle case variations
	if audio != nil {
		audio.CodecName = strings.ToLower(audio.CodecName)
	}
	if video != nil {
		video.CodecName = strings.ToLower(video.CodecName)
	}

	hlsDir := "./hls/" + roomID
	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		return nil, nil, fmt.Errorf("create hls directory: %w", err)
	}

	// ---- Allocate UDP connections BEFORE starting FFmpeg to avoid race condition ----
	audioConn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0})
	if err != nil {
		return nil, nil, fmt.Errorf("allocate audio port: %w", err)
	}
	defer func() {
		if audioConn != nil && err != nil {
			audioConn.Close()
		}
	}()

	videoConn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: 0})
	if err != nil {
		audioConn.Close()
		return nil, nil, fmt.Errorf("allocate video port: %w", err)
	}
	defer func() {
		if videoConn != nil && err != nil {
			videoConn.Close()
		}
	}()

	audioPort := audioConn.LocalAddr().(*net.UDPAddr).Port
	videoPort := videoConn.LocalAddr().(*net.UDPAddr).Port

	log.Printf("[HLS] audio UDP port=%d  video UDP port=%d  audio_codec=%v video_codec=%v",
		audioPort, videoPort,
		codecSummary(audio), codecSummary(video))

	// ---- write SDP file for FFmpeg ----
	sdpContent := buildSDP(audioPort, audio, videoPort, video)
	sdpPath := filepath.Join(hlsDir, "stream.sdp")
	if err := os.WriteFile(sdpPath, []byte(sdpContent), 0644); err != nil {
		audioConn.Close()
		videoConn.Close()
		return nil, nil, fmt.Errorf("write sdp: %w", err)
	}
	log.Printf("[HLS] SDP written to %s", sdpPath)

	// ---- build FFmpeg args dynamically based on codecs ----
	args := []string{
		"-loglevel", "warning",
		"-fflags", "+genpts+discardcorrupt",
		"-max_delay", "5000000", // 5s max reorder buffer for RTP jitter
		"-analyzeduration", "10000000",
		"-probesize", "5000000",
		"-protocol_whitelist", "file,udp,rtp",
		"-i", sdpPath,
		// audio → aac
		"-c:a", "aac",
		"-b:a", "128k",
		"-ar", "48000",
		"-ac", "2",
	}

	// If the source is already H264, just copy (no re-encode → much less CPU).
	// For VP8/VP9/AV1 we need to transcode to H264 for HLS compatibility.
	if video != nil && video.CodecName == "h264" {
		args = append(args,
			"-c:v", "copy",
			"-bsf:v", "h264_mp4toannexb",
		)
		log.Println("[HLS] video codec is h264, using copy mode (no re-encode)")
	} else if video != nil {
		args = append(args,
			"-c:v", "libx264",
			"-preset", "ultrafast",
			"-tune", "zerolatency",
			"-g", "30",
			"-sc_threshold", "0",
			"-b:v", "1500k",
			"-maxrate", "1500k",
			"-bufsize", "3000k",
			"-pix_fmt", "yuv420p",
		)
		log.Printf("[HLS] video codec is %s, transcoding to H264", video.CodecName)
	}

	args = append(args,
		"-f", "hls",
		"-hls_time", "2",
		"-hls_list_size", "5",
		"-hls_flags", "delete_segments",
		filepath.Join(hlsDir, "index.m3u8"),
	)

	// ---- launch FFmpeg ----
	cmd := exec.Command("ffmpeg", args...)

	// Suppress stdout/stderr spam log
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		audioConn.Close()
		videoConn.Close()
		return nil, nil, fmt.Errorf("start ffmpeg: %w", err)
	}
	log.Printf("[HLS] FFmpeg started (PID %d) for room %s", cmd.Process.Pid, roomID)

	// Wait for the HLS playlist file to be created (indicates FFmpeg is ready)
	m3u8Path := filepath.Join(hlsDir, "index.m3u8")
	maxRetries := 50 // 5 seconds max wait (50 * 100ms)
	for i := 0; i < maxRetries; i++ {
		if _, err := os.Stat(m3u8Path); err == nil {
			log.Println("[HLS] HLS stream file created, ready to accept packets")
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	stop := func() {
		audioConn.Close()
		videoConn.Close()
		if cmd.Process != nil {
			// Graceful shutdown: send SIGTERM first
			cmd.Process.Signal(syscall.SIGTERM)

			// Wait up to 2 seconds for graceful shutdown
			done := make(chan error, 1)
			go func() {
				done <- cmd.Wait()
			}()

			select {
			case <-time.After(2 * time.Second):
				// Timeout: force kill
				log.Printf("[HLS] FFmpeg graceful shutdown timeout, killing PID %d", cmd.Process.Pid)
				cmd.Process.Kill()
			case <-done:
				log.Printf("[HLS] FFmpeg stopped gracefully")
			}
		}

		// Clean up HLS directory
		if err := os.RemoveAll(hlsDir); err != nil {
			log.Printf("[HLS] failed to clean up directory %s: %v", hlsDir, err)
		}
	}

	RegisterToStream(roomID, stop)

	// Convert *net.UDPConn to net.Conn for HLSWriter
	return &HLSWriter{AudioConn: audioConn, VideoConn: videoConn}, stop, nil
}

func codecSummary(c *CodecInfo) string {
	if c == nil {
		return "<nil>"
	}
	return fmt.Sprintf("PT=%d %s/%d", c.PayloadType, c.CodecName, c.ClockRate)
}
