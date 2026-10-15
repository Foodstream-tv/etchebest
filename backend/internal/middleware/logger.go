package middleware

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
)

// pathWithoutQuery drops the query string from a logged path. Some endpoints carry a session token
// in it (`?token=<JWT>` for the WebSocket), which must never end up in the access logs.
func pathWithoutQuery(path string) string {
	if i := strings.IndexByte(path, '?'); i >= 0 {
		return path[:i]
	}
	return path
}

func formatAccessLog(p gin.LogFormatterParams) string {
	return fmt.Sprintf("[GIN] %s | %3d | %13v | %15s | %-7s %#v\n%s",
		p.TimeStamp.Format("2006/01/02 - 15:04:05"),
		p.StatusCode,
		p.Latency,
		p.ClientIP,
		p.Method,
		pathWithoutQuery(p.Path),
		p.ErrorMessage,
	)
}

// AccessLogger is gin's default request logger without the query string.
func AccessLogger() gin.HandlerFunc {
	return gin.LoggerWithConfig(gin.LoggerConfig{Formatter: formatAccessLog})
}
