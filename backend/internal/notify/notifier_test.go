package notify

import (
	"testing"
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
