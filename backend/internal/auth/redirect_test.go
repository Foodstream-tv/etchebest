package auth

import "testing"

func TestSafeRedirect(t *testing.T) {
	t.Setenv("ALLOWED_REDIRECT_ORIGINS", "https://foodstream.tv, http://localhost:3002")

	allowed := []string{
		"https://foodstream.tv/auth/callback",
		"http://localhost:3002/auth/callback",
		"HTTPS://FOODSTREAM.TV/auth/callback",
	}
	for _, raw := range allowed {
		if got := safeRedirect(raw); got != raw {
			t.Errorf("safeRedirect(%q) = %q, want it accepted", raw, got)
		}
	}

	refused := []string{
		"",
		"https://evil.test/",
		"https://foodstream.tv.evil.test/auth/callback",
		"https://foodstream.tv@evil.test/auth/callback",
		"https://evil.test/https://foodstream.tv/",
		"//evil.test/",
		"/auth/callback",
		"javascript:alert(1)",
		"http://foodstream.tv/auth/callback",
		"https://foodstream.tv:444/auth/callback",
		"https://foodstream.tv\\@evil.test/",
	}
	for _, raw := range refused {
		if got := safeRedirect(raw); got != "" {
			t.Errorf("safeRedirect(%q) = %q, want it refused", raw, got)
		}
	}
}

func TestAllowedRedirectOriginsDefaultsToAppURL(t *testing.T) {
	t.Setenv("ALLOWED_REDIRECT_ORIGINS", "")
	t.Setenv("APP_URL", "https://app.example.com/")
	if safeRedirect("https://app.example.com/auth/callback") == "" {
		t.Error("APP_URL origin must be allowed by default")
	}
	if safeRedirect("http://localhost:3000/auth/callback") != "" {
		t.Error("localhost must not be allowed when APP_URL is set")
	}
}
