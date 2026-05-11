package hls

import (
	"fmt"
	"io"
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
	CodecName   string
	ClockRate   uint32
	Channels    uint16
	FmtpLine    string
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
	defer l.Close()

	return l.LocalAddr().(*net.UDPAddr).Port, nil
}

func getFreeRTPPort() (int, error) {
	for i := 0; i < 50; i++ {
		port, err := getFreePort()
		if err != nil {
			return 0, err
		}

		rtcpPort := port + 1

		addr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("127.0.0.1:%d", rtcpPort))
		if err != nil {
			continue
		}

		l, err := net.ListenUDP("udp4", addr)
		if err != nil {
			continue
		}

		l.Close()
		return port, nil
	}

	return 0, fmt.Errorf("could not find free RTP/RTCP port pair")
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
// UDP ports and produces an adaptive HLS stream.
func Start(roomID string, audio *CodecInfo, video *CodecInfo) (*HLSWriter, func(), error) {
	hlsDir := filepath.Join("./hls", roomID)

	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		return nil, nil, err
	}

	audioPort, err := getFreeRTPPort()
	if err != nil {
		return nil, nil, fmt.Errorf("find audio port: %w", err)
	}

	videoPort, err := getFreeRTPPort()
	for videoPort == audioPort || videoPort == audioPort+1 || videoPort+1 == audioPort {
		videoPort, err = getFreeRTPPort()
		if err != nil {
			return nil, nil, fmt.Errorf("find video port: %w", err)
		}
	}

	if err != nil {
		return nil, nil, fmt.Errorf("find video port: %w", err)
	}

	log.Printf("[HLS] audio UDP port=%d video UDP port=%d audio_codec=%v video_codec=%v",
		audioPort, videoPort, codecSummary(audio), codecSummary(video))

	sdpContent := buildSDP(audioPort, audio, videoPort, video)
	sdpPath := filepath.Join(hlsDir, "stream.sdp")

	if err := os.WriteFile(sdpPath, []byte(sdpContent), 0644); err != nil {
		return nil, nil, fmt.Errorf("write sdp: %w", err)
	}

	log.Printf("[HLS] SDP written to %s:\n%s", sdpPath, sdpContent)

	for _, quality := range []string{"1080p", "720p", "480p", "360p"} {
		if err := os.MkdirAll(filepath.Join(hlsDir, quality), 0755); err != nil {
			return nil, nil, err
		}
	}

	args := []string{
		"-loglevel", "warning",
		"-fflags", "+genpts+discardcorrupt+nobuffer+flush_packets",
		"-use_wallclock_as_timestamps", "1",
		"-max_delay", "100000",
		"-analyzeduration", "0",
		"-probesize", "500000",
		"-protocol_whitelist", "file,udp,rtp",

		"-i", sdpPath,

		"-filter_complex",
		"[0:v]fps=30,split=4[v1080][v720][v480][v360];"+
			"[v1080]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080out];"+
			"[v720]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720out];"+
			"[v480]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v480out];"+
			"[v360]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360out]",

		"-map", "[v1080out]",
		"-map", "0:a?",
		"-c:v:0", "libx264",
		"-preset:v:0", "veryfast",
		"-tune:v:0", "zerolatency",
		"-b:v:0", "5000k",
		"-maxrate:v:0", "5500k",
		"-bufsize:v:0", "10000k",
		"-g:v:0", "30",
		"-keyint_min:v:0", "30",
		"-sc_threshold:v:0", "0",
		"-level:v:0", "4.2",
		"-c:a:0", "aac",
		"-b:a:0", "128k",
		"-af:a:0", "aresample=async=1:first_pts=0",

		"-map", "[v720out]",
		"-map", "0:a?",
		"-c:v:1", "libx264",
		"-preset:v:1", "veryfast",
		"-tune:v:1", "zerolatency",
		"-b:v:1", "2800k",
		"-maxrate:v:1", "3200k",
		"-bufsize:v:1", "5600k",
		"-g:v:1", "30",
		"-keyint_min:v:1", "30",
		"-sc_threshold:v:1", "0",
		"-level:v:1", "4.0",
		"-c:a:1", "aac",
		"-b:a:1", "128k",
		"-af:a:1", "aresample=async=1:first_pts=0",

		"-map", "[v480out]",
		"-map", "0:a?",
		"-c:v:2", "libx264",
		"-preset:v:2", "veryfast",
		"-tune:v:2", "zerolatency",
		"-b:v:2", "1200k",
		"-maxrate:v:2", "1400k",
		"-bufsize:v:2", "2400k",
		"-g:v:2", "30",
		"-keyint_min:v:2", "30",
		"-sc_threshold:v:2", "0",
		"-level:v:2", "3.1",
		"-c:a:2", "aac",
		"-b:a:2", "96k",
		"-af:a:2", "aresample=async=1:first_pts=0",

		"-map", "[v360out]",
		"-map", "0:a?",
		"-c:v:3", "libx264",
		"-preset:v:3", "veryfast",
		"-tune:v:3", "zerolatency",
		"-b:v:3", "700k",
		"-maxrate:v:3", "900k",
		"-bufsize:v:3", "1400k",
		"-g:v:3", "30",
		"-keyint_min:v:3", "30",
		"-sc_threshold:v:3", "0",
		"-level:v:3", "3.0",
		"-c:a:3", "aac",
		"-b:a:3", "64k",
		"-af:a:3", "aresample=async=1:first_pts=0",

		"-f", "hls",
		"-hls_time", "0.5",
		"-hls_list_size", "0",
		"-hls_flags", "omit_endlist+independent_segments",
		"-master_pl_name", "master.m3u8",
		"-var_stream_map", "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p",
		"-hls_segment_filename", filepath.Join(hlsDir, "%v", "segment_%03d.ts"),
		filepath.Join(hlsDir, "%v", "index.m3u8"),
	}

	cmd := exec.Command("ffmpeg", args...)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, nil, fmt.Errorf("ffmpeg stdin pipe: %w", err)
	}

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return nil, nil, fmt.Errorf("start ffmpeg: %w", err)
	}

	log.Printf("[HLS] FFmpeg started PID=%d room=%s", cmd.Process.Pid, roomID)

	time.Sleep(500 * time.Millisecond)

	audioConn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", audioPort))
	if err != nil {
		gracefulStopFFmpeg(roomID, cmd, stdin)
		return nil, nil, fmt.Errorf("dial audio udp: %w", err)
	}

	videoConn, err := net.Dial("udp4", fmt.Sprintf("127.0.0.1:%d", videoPort))
	if err != nil {
		_ = audioConn.Close()
		gracefulStopFFmpeg(roomID, cmd, stdin)
		return nil, nil, fmt.Errorf("dial video udp: %w", err)
	}

	stop := func() {
		_ = audioConn.Close()
		_ = videoConn.Close()

		gracefulStopFFmpeg(roomID, cmd, stdin)
	}

	RegisterToStream(roomID, stop)

	return &HLSWriter{
		AudioConn: audioConn,
		VideoConn: videoConn,
	}, stop, nil
}

func gracefulStopFFmpeg(roomID string, cmd *exec.Cmd, stdin io.WriteCloser) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	_, _ = stdin.Write([]byte("q\n"))
	_ = stdin.Close()

	done := make(chan error, 1)

	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			log.Printf("[HLS] ffmpeg stopped for room %s with error: %v", roomID, err)
		} else {
			log.Printf("[HLS] ffmpeg stopped gracefully for room %s", roomID)
		}

	case <-time.After(5 * time.Second):
		log.Printf("[HLS] ffmpeg graceful stop timeout, killing room %s", roomID)

		if err := cmd.Process.Kill(); err != nil {
			log.Printf("[HLS] failed to kill ffmpeg for room %s: %v", roomID, err)
		}

		<-done
	}
}

func codecSummary(c *CodecInfo) string {
	if c == nil {
		return "<nil>"
	}

	return fmt.Sprintf("PT=%d %s/%d", c.PayloadType, c.CodecName, c.ClockRate)
}