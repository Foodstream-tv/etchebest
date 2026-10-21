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

// LadderName is "full" or "light" (a busy server encodes fewer renditions).
func (w *HLSWriter) LadderName() string {
	if w == nil || w.sup == nil {
		return ""
	}
	return w.sup.ladder.Name
}

// Status is the health of the HLS pipeline behind this writer.
func (w *HLSWriter) Status() Status {
	if w == nil || w.sup == nil {
		return StatusUnavailable
	}
	return w.sup.status()
}

// SourceSize is the picture size the publisher sends, when known (0x0 otherwise).
type SourceSize struct {
	Width, Height int
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
func buildFFmpegArgs(sdpPath, hlsDir string, restart bool, ladder Ladder) []string {
	hlsFlags := "append_list+independent_segments"
	if restart {
		hlsFlags += "+discont_start"
	}
	args := []string{
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

		"-filter_complex", ladder.filterGraph(),

		"-af", "aresample=async=1:first_pts=0",
	}
	args = append(args, ladder.outputArgs()...)
	args = append(args,
		"-force_key_frames", "expr:floor(t/2)*2",

		"-f", "hls",
		"-hls_time", "2",
		"-hls_list_size", "0",
		"-hls_playlist_type", "event",
		"-hls_flags", hlsFlags,
		"-master_pl_name", "master.m3u8",
		"-var_stream_map", ladder.varStreamMap(),
		"-hls_segment_filename", filepath.Join(hlsDir, "%v", "segment_%03d.ts"),
		filepath.Join(hlsDir, "%v", "index.m3u8"),
	)
	return args
}

func codecSummary(c *CodecInfo) string {
	if c == nil {
		return "<nil>"
	}

	return fmt.Sprintf("PT=%d %s/%d", c.PayloadType, c.CodecName, c.ClockRate)
}
