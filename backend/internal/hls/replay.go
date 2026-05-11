package hls

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func GenerateReplay(roomID string) (string, error) {
	hlsDir := filepath.Join("./hls", roomID)
	playlistPath := filepath.Join(hlsDir, "index.m3u8")

	if _, err := os.Stat(playlistPath); err != nil {
		return "", fmt.Errorf("playlist not found for room %s: %w", roomID, err)
	}

	replayDir := "./storage/replays"
	if err := os.MkdirAll(replayDir, 0755); err != nil {
		return "", fmt.Errorf("create replay dir: %w", err)
	}

	outputPath := filepath.Join(replayDir, roomID+".mp4")

	args := []string{
		"-y",
		"-loglevel", "warning",
		"-i", playlistPath,
		"-c", "copy",
		"-movflags", "+faststart",
		outputPath,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	log.Printf("[REPLAY] generating replay for room %s", roomID)

	if err := cmd.Run(); err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("generate replay timeout after 30s")
		}

		return "", fmt.Errorf("generate replay: %w", err)
	}

	publicURL := "/replays-storage/" + roomID + ".mp4"

	log.Printf("[REPLAY] replay generated for room %s: %s", roomID, publicURL)

	return publicURL, nil
}