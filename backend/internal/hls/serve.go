package hls

import (
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var (
	segmentNamePattern = regexp.MustCompile(`^segment_[0-9]{1,9}\.ts$`)
	qualityPattern     = regexp.MustCompile(`^[0-9]{3,4}p$`)
)

// liveFile maps a request path ("<room>/master.m3u8", "<room>/720p/index.m3u8", "<room>/720p/segment_004.ts")
// to a file of the live tree, or "" for anything else. Only what a player fetches is served: the directory
// listing, the SDP FFmpeg reads and any other file are not.
func liveFile(requestPath string) (file string, isMediaPlaylist bool) {
	parts := strings.Split(strings.Trim(requestPath, "/"), "/")
	if len(parts) < 2 || len(parts) > 3 {
		return "", false
	}
	dir, err := roomDir(liveDir, parts[0])
	if err != nil {
		return "", false
	}
	switch {
	case len(parts) == 2 && parts[1] == "master.m3u8":
		return filepath.Join(dir, "master.m3u8"), false
	case len(parts) == 3 && qualityPattern.MatchString(parts[1]) && parts[2] == "index.m3u8":
		return filepath.Join(dir, parts[1], "index.m3u8"), true
	case len(parts) == 3 && qualityPattern.MatchString(parts[1]) && segmentNamePattern.MatchString(parts[2]):
		return filepath.Join(dir, parts[1], parts[2]), false
	}
	return "", false
}

// ServeLive serves the in-progress HLS tree under /api/hls/*filepath. Media playlists are cut to a sliding
// window (WindowPlaylist); the master playlist and the segments are served as they are.
func ServeLive() gin.HandlerFunc {
	return func(c *gin.Context) {
		file, isMediaPlaylist := liveFile(c.Param("filepath"))
		if file == "" {
			c.Status(http.StatusNotFound)
			return
		}
		if !isMediaPlaylist {
			if _, err := os.Stat(file); err != nil {
				c.Status(http.StatusNotFound)
				return
			}
			c.File(file)
			return
		}
		full, err := os.ReadFile(file)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		window, _ := liveWindow() // validated at startup
		c.Data(http.StatusOK, "application/vnd.apple.mpegurl", WindowPlaylist(full, window))
	}
}
