package hls

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
)

// ErrNoReplayContent means the live produced nothing worth keeping (no master playlist yet, e.g. it
// ended before the first segment). The source directory is then safe to delete.
var ErrNoReplayContent = errors.New("no replay content")

func copyDir(src string, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if !srcInfo.IsDir() {
		return fmt.Errorf("%s is not a directory", src)
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}

		if err := copyFile(srcPath, dstPath); err != nil {
			return err
		}
	}

	return nil
}

func copyFile(src string, dst string) error {
	input, err := os.Open(src)
	if err != nil {
		return err
	}
	defer input.Close()

	info, err := input.Stat()
	if err != nil {
		return err
	}

	output, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, input)
	return err
}

func GenerateReplay(roomID string) (string, error) {
	sourceDir := filepath.Join("./hls", roomID)
	replayDir := filepath.Join("./storage/replays", roomID)

	masterPath := filepath.Join(sourceDir, "master.m3u8")
	if _, err := os.Stat(masterPath); err != nil {
		return "", fmt.Errorf("master playlist not found for room %s: %w: %w", roomID, ErrNoReplayContent, err)
	}

	if err := os.RemoveAll(replayDir); err != nil {
		return "", fmt.Errorf("clean replay dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(replayDir), 0o755); err != nil {
		return "", fmt.Errorf("create replays dir: %w", err)
	}

	// Moving the directory is instant and atomic on the same filesystem (a 2 h live is several GB:
	// copying it took minutes). Fall back to a copy only when the rename is not possible.
	if err := os.Rename(sourceDir, replayDir); err != nil {
		log.Printf("[REPLAY] rename failed for room %s (%v), falling back to copy", roomID, err)
		if err := copyDir(sourceDir, replayDir); err != nil {
			// Do not leave a half-copied replay behind: the source is still intact and is kept.
			_ = os.RemoveAll(replayDir)
			return "", fmt.Errorf("copy hls replay: %w", err)
		}
	}

	publicURL := "/replays-storage/" + roomID + "/master.m3u8"

	log.Printf("[REPLAY] HLS replay generated for room %s: %s", roomID, publicURL)

	return publicURL, nil
}
