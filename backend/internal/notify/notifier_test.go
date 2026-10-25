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

func TestUserTextKeepsUserInputOnOneLine(t *testing.T) {
	cases := map[string]string{
		"Chef Anna":                            "Chef Anna",
		"Anna\r\nBcc: victim@example.com":      "Anna Bcc: victim@example.com",
		"Tarte\n\n\nCliquez ici":               "Tarte Cliquez ici",
		"  espaces   multiples\t":              "espaces multiples",
		"bip\x07\x00":                          "bip",
		strings.Repeat("é", maxUserTextLen+10): strings.Repeat("é", maxUserTextLen) + "…",
	}
	for in, want := range cases {
		if got := userText(in); got != want {
			t.Errorf("userText(%q) = %q, want %q", in, got, want)
		}
	}
}
