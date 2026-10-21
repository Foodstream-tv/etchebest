package hls

import (
	"fmt"
	"net"
	"path/filepath"
)

// HLSWriter holds the UDP connections for writing RTP audio/video data to FFmpeg.
type HLSWriter struct {
	AudioConn net.Conn
	VideoConn net.Conn

	sup *supervisor
}

// SetOnRestart registers what to do each time FFmpeg had to be restarted (typically: ask the
// publisher for a keyframe, so the new process can start decoding straight away).
func (w *HLSWriter) SetOnRestart(fn func()) {
	if w != nil && w.sup != nil {
		w.sup.setOnRestart(fn)
	}
}

// Status is the health of the HLS pipeline behind this writer.
func (w *HLSWriter) Status() Status {
	if w == nil || w.sup == nil {
		return StatusUnavailable
	}
	return w.sup.status()
}

// CodecInfo describes the negotiated codec for one media stream.
type CodecInfo struct {
	PayloadType uint8
	CodecName   string
	ClockRate   uint32
	Channels    uint16
	FmtpLine    string
}

// buildSDP builds a minimal SDP string for FFmpeg with the given codecs and ports.
func buildSDP(audioPort int, audio *CodecInfo, videoPort int, video *CodecInfo) string {
	sdp := "v=0\n"
	sdp += "o=- 0 0 IN IP4 0.0.0.0\n"
	sdp += "s=WebRTC to HLS\n"
	sdp += "c=IN IP4 0.0.0.0\n"
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

// buildFFmpegArgs returns the FFmpeg command line that turns the RTP streams described by sdpPath
// into the adaptive HLS ladder in hlsDir. After a restart (restart=true) the playlists are appended
// to and a discontinuity is announced, so players resume instead of stalling on a timestamp jump.
func buildFFmpegArgs(sdpPath, hlsDir string, restart bool) []string {
	hlsFlags := "append_list+independent_segments"
	if restart {
		hlsFlags += "+discont_start"
	}
	return []string{
		"-loglevel", "warning",
		"-rtbufsize", "5000k",
		"-fflags", "+genpts+discardcorrupt+nobuffer+flush_packets",
		"-use_wallclock_as_timestamps", "1",
		"-max_delay", "3000000",
		"-analyzeduration", "10000000",
		"-probesize", "2000000",
		"-protocol_whitelist", "file,udp,rtp",

		"-i", sdpPath,

		"-fps_mode", "cfr",

		"-filter_complex",
		"[0:v]fps=30,split=4[v1080][v720][v480][v360];" +
			"[v1080]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080out];" +
			"[v720]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720out];" +
			"[v480]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v480out];" +
			"[v360]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360out]",

		"-af", "aresample=async=1:first_pts=0",

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

		"-force_key_frames", "expr:floor(t/2)*2",

		"-f", "hls",
		"-hls_time", "2",
		"-hls_list_size", "0",
		"-hls_playlist_type", "event",
		"-hls_flags", hlsFlags,
		"-master_pl_name", "master.m3u8",
		"-var_stream_map", "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p",
		"-hls_segment_filename", filepath.Join(hlsDir, "%v", "segment_%03d.ts"),
		filepath.Join(hlsDir, "%v", "index.m3u8"),
	}
}

func codecSummary(c *CodecInfo) string {
	if c == nil {
		return "<nil>"
	}

	return fmt.Sprintf("PT=%d %s/%d", c.PayloadType, c.CodecName, c.ClockRate)
}
