package middleware

import (
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestPathWithoutQuery(t *testing.T) {
	cases := map[string]string{
		"/api/webrtc/offers?token=eyJhbGciOi.secret": "/api/webrtc/offers",
		"/api/lives": "/api/lives",
		"/a?b=1?c=2": "/a",
		"":           "",
	}
	for in, want := range cases {
		if got := pathWithoutQuery(in); got != want {
			t.Errorf("pathWithoutQuery(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAccessLogNeverContainsTheToken(t *testing.T) {
	line := formatAccessLog(gin.LogFormatterParams{
		TimeStamp:  time.Now(),
		StatusCode: 200,
		ClientIP:   "203.0.113.7",
		Method:     "GET",
		Path:       "/api/webrtc/offers?token=eyJhbGciOi.secret",
	})
	if strings.Contains(line, "secret") || strings.Contains(line, "token") {
		t.Fatalf("access log leaks the query string: %q", line)
	}
	if !strings.Contains(line, "/api/webrtc/offers") {
		t.Fatalf("access log lost the path: %q", line)
	}
}
