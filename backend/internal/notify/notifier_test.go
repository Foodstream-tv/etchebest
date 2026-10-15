package notify

import (
	"bytes"
	"log"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestMaskEmail(t *testing.T) {
	cases := []struct {
		email    string
		expected string
	}{
		{"john.doe@example.com", "j***e@example.com"},
		{"a@example.com", "a***@example.com"},
		{"invalid-email", "***"},
	}

	for _, c := range cases {
		result := MaskEmail(c.email)
		if result != c.expected {
			t.Errorf("MaskEmail(%q) = %q; want %q", c.email, result, c.expected)
		}
	}
}

func TestLogSimulationKeepsSecretsOutOfProductionLogs(t *testing.T) {
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)
	prev := gin.Mode()
	defer gin.SetMode(prev)

	t.Setenv("DEV_MODE", "true")
	gin.SetMode(gin.ReleaseMode)
	logSimulation("verification email", "jane.doe@example.com", "Code: 123456")
	out := buf.String()
	if strings.Contains(out, "123456") || strings.Contains(out, "jane.doe@example.com") {
		t.Fatalf("release mode must not log the code or the address: %q", out)
	}

	buf.Reset()
	t.Setenv("DEV_MODE", "false")
	gin.SetMode(gin.DebugMode)
	logSimulation("verification email", "jane.doe@example.com", "Code: 123456")
	if strings.Contains(buf.String(), "123456") {
		t.Fatalf("DEV_MODE=false must not log the code: %q", buf.String())
	}

	buf.Reset()
	t.Setenv("DEV_MODE", "true")
	gin.SetMode(gin.DebugMode)
	logSimulation("verification email", "jane.doe@example.com", "Code: 123456")
	if !strings.Contains(buf.String(), "123456") {
		t.Fatalf("dev mode should still print the code for local testing: %q", buf.String())
	}
}
