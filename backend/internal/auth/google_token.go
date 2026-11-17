package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"time"
)

// Google endpoints and client: variables so the tests can point them at a local server.
var (
	googleUserInfoURL  = "https://www.googleapis.com/oauth2/v2/userinfo"
	googleTokenInfoURL = "https://oauth2.googleapis.com/tokeninfo"
	googleHTTPClient   = &http.Client{Timeout: 5 * time.Second}
)

// Refusals (the token or profile is not acceptable) and failures (we could not ask Google, or it is not
// configured here) are told apart: the first is the caller's problem (401), the others are ours.
var (
	errGoogleProfile     = errors.New("google did not return a usable, verified profile")
	errGoogleAudience    = errors.New("google access token was not issued to one of our applications")
	errGoogleNoClient    = errors.New("no Google client ID is configured for the mobile sign-in")
	errGoogleUnavailable = errors.New("google could not be reached or answered with an error")
)

// MobileGoogleClientIDs is the allow-list of OAuth clients for the mobile sign-in (see mobileGoogleClientIDs).
func MobileGoogleClientIDs() []string { return mobileGoogleClientIDs() }

// googleStatusError classifies a non-200 answer: Google rejecting the token is a refusal, a 5xx is an outage.
func googleStatusError(what string, status int) error {
	if status >= http.StatusInternalServerError || status == http.StatusTooManyRequests {
		return fmt.Errorf("%w: %s answered %d", errGoogleUnavailable, what, status)
	}
	return fmt.Errorf("google %s refused the token (%d)", what, status)
}

// mobileGoogleClientIDs lists the Google OAuth clients whose access tokens the mobile sign-in accepts:
// the web client of the backend (GOOGLE_CLIENT_ID) and the clients of the mobile app
// (GOOGLE_MOBILE_CLIENT_IDS, comma-separated: its web, Android and iOS client IDs).
func mobileGoogleClientIDs() []string {
	var ids []string
	add := func(id string) {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	add(os.Getenv("GOOGLE_CLIENT_ID"))
	for _, id := range strings.Split(os.Getenv("GOOGLE_MOBILE_CLIENT_IDS"), ",") {
		add(id)
	}
	return ids
}

// getGoogleUserInfo fetches the profile behind an access token and only returns one that can be trusted
// to identify somebody: Google answered 200, gave a stable ID and an e-mail it states is verified.
// An error body, an empty profile or an unverified address is an error, never a blank user.
func getGoogleUserInfo(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	if accessToken == "" {
		return nil, errGoogleProfile
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken) // not in the URL, which ends up in logs

	resp, err := googleHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: userinfo: %v", errGoogleUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, googleStatusError("userinfo", resp.StatusCode)
	}

	var info GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("%w: userinfo body: %v", errGoogleUnavailable, err)
	}
	if info.ID == "" || strings.TrimSpace(info.Email) == "" || !info.VerifiedEmail {
		return nil, errGoogleProfile
	}
	return &info, nil
}

// googleTokenAudience asks Google which OAuth client an access token was issued to.
func googleTokenAudience(ctx context.Context, accessToken string) (string, error) {
	form := url.Values{"access_token": {accessToken}} // POST body, not the URL
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenInfoURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := googleHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: tokeninfo: %v", errGoogleUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", googleStatusError("tokeninfo", resp.StatusCode)
	}
	var info struct {
		Aud string `json:"aud"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", fmt.Errorf("%w: tokeninfo body: %v", errGoogleUnavailable, err)
	}
	return info.Aud, nil
}

// verifyGoogleMobileToken accepts a Google access token sent by the mobile app only when it was issued
// to one of our own OAuth clients. Without that check a token Google gave to any other application
// would sign its owner in here.
func verifyGoogleMobileToken(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	allowed := mobileGoogleClientIDs()
	if len(allowed) == 0 {
		return nil, errGoogleNoClient
	}
	aud, err := googleTokenAudience(ctx, accessToken)
	if err != nil {
		return nil, err
	}
	if !slices.Contains(allowed, aud) { // allowed never holds an empty ID, so an empty audience fails here
		return nil, errGoogleAudience
	}
	return getGoogleUserInfo(ctx, accessToken)
}
