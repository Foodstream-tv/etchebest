package hls

import (
	"fmt"
	"log"
	"os"
	"io"
	"path/filepath"
)

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
		return "", fmt.Errorf("master playlist not found for room %s: %w", roomID, err)
	}

	if err := os.RemoveAll(replayDir); err != nil {
		return "", fmt.Errorf("clean replay dir: %w", err)
	}

	if err := copyDir(sourceDir, replayDir); err != nil {
		return "", fmt.Errorf("copy hls replay: %w", err)
	}

	publicURL := "/replays-storage/" + roomID + "/master.m3u8"

	log.Printf("[REPLAY] HLS replay generated for room %s: %s", roomID, publicURL)

	return publicURL, nil
}