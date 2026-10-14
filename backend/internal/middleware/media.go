package middleware

import (
	"path"
	"strings"

	"github.com/gin-gonic/gin"
)

// MediaHeaders sets the Content-Type and Cache-Control of HLS / replay files before the static
// handler serves them.
//
//   - Go's built-in MIME table knows neither .m3u8 nor .ts and Alpine ships no /etc/mime.types, so
//     files would be sniffed as text/plain or octet-stream, which Safari / iOS native HLS rejects.
//   - A live playlist changes every few seconds and must never be cached; segments and finished
//     (replay) files never change once written.
//
// live=true is for the in-progress HLS tree, live=false for stored replays.
func MediaHeaders(live bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		switch strings.ToLower(path.Ext(c.Request.URL.Path)) {
		case ".m3u8":
			h.Set("Content-Type", "application/vnd.apple.mpegurl")
			if live {
				h.Set("Cache-Control", "no-cache, no-store, must-revalidate")
			} else {
				h.Set("Cache-Control", "public, max-age=3600")
			}
		case ".ts":
			h.Set("Content-Type", "video/mp2t")
			if live {
				h.Set("Cache-Control", "public, max-age=30")
			} else {
				h.Set("Cache-Control", "public, max-age=31536000, immutable")
			}
		case ".mp4":
			h.Set("Content-Type", "video/mp4")
			h.Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.Next()
	}
}
