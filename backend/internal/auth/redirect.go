package auth

import (
	"net/url"
	"os"
	"strings"
)

// allowedRedirectOrigins lists the origins a Google sign-in may send the user
// back to. ALLOWED_REDIRECT_ORIGINS is a comma-separated list; when empty, the
// web app URL (APP_URL, default http://localhost:3000) is the only origin.
func allowedRedirectOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("ALLOWED_REDIRECT_ORIGINS"))
	if raw == "" {
		raw = os.Getenv("APP_URL")
	}
	if strings.TrimSpace(raw) == "" {
		raw = "http://localhost:3000"
	}
	var origins []string
	for _, part := range strings.Split(raw, ",") {
		if o := originOf(strings.TrimSpace(part)); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

// originOf returns "scheme://host[:port]" of an absolute http(s) URL, or "".
func originOf(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil {
		return ""
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return ""
	}
	return strings.ToLower(u.Scheme + "://" + u.Host)
}

// safeRedirect returns the URL to send the user back to after sign-in, or ""
// when it is not an absolute http(s) URL on an allowed origin.
func safeRedirect(raw string) string {
	origin := originOf(raw)
	if origin == "" || strings.ContainsAny(raw, "\\\r\n") {
		return ""
	}
	for _, allowed := range allowedRedirectOrigins() {
		if origin == allowed {
			return raw
		}
	}
	return ""
}
