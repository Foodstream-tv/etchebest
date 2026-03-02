package hls

import (
	"os"
	"os/exec"
)

func Start(roomID string) (*os.File, func(), error) {
	if err := os.MkdirAll("./hls/"+roomID, 0755); err != nil {
		return nil, nil, err
	}

	cmd := exec.Command(
		"ffmpeg",
		"-loglevel", "error",
		"-f", "rtp",
		"-i", "pipe:0",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-tune", "zerolatency",
		"-g", "60",
		"-sc_threshold", "0",
		"-f", "hls",
		"-hls_time", "2",
		"-hls_list_size", "5",
		"-hls_flags", "delete_segments",
		"./hls/"+roomID+"/index.m3u8",
	)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, nil, err
	}

	stop := func() {
		cmd.Process.Kill()
	}

	RegisterToStream(roomID, stop)

	return stdin.(*os.File), stop, nil
}
