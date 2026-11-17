package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
)

// fakeGoogle points the Google endpoints at a local server for the length of the test.
// tokenInfo and userInfo answer the two calls; the counters tell which of them were made.
type fakeGoogle struct {
	tokenInfoCalls, userInfoCalls atomic.Int32
}

func newFakeGoogle(t *testing.T, tokenInfo, userInfo http.HandlerFunc) *fakeGoogle {
	t.Helper()
	g := &fakeGoogle{}
	mux := http.NewServeMux()
	mux.HandleFunc("/tokeninfo", func(w http.ResponseWriter, r *http.Request) {
		g.tokenInfoCalls.Add(1)
		tokenInfo(w, r)
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		g.userInfoCalls.Add(1)
		userInfo(w, r)
	})
	srv := httptest.NewServer(mux)

	prevUser, prevToken := googleUserInfoURL, googleTokenInfoURL
	googleUserInfoURL, googleTokenInfoURL = srv.URL+"/userinfo", srv.URL+"/tokeninfo"
	t.Cleanup(func() {
		googleUserInfoURL, googleTokenInfoURL = prevUser, prevToken
		srv.Close()
	})
	return g
}

func jsonAnswer(status int, body any) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	}
}

var goodProfile = map[string]any{
	"id": "1234567890", "email": "Jane@Example.com", "verified_email": true,
	"given_name": "Jane", "family_name": "Doe", "picture": "https://example.com/p.png",
}

func TestUserInfoRejectsAnythingButAVerifiedProfile(t *testing.T) {
	cases := map[string]http.HandlerFunc{
		// What Google sends for a token it does not know: an error object, which decodes as an empty profile.
		"error answer":     jsonAnswer(http.StatusUnauthorized, map[string]any{"error": map[string]any{"code": 401, "status": "UNAUTHENTICATED"}}),
		"200 with no body": jsonAnswer(http.StatusOK, map[string]any{}),
		"no id":            jsonAnswer(http.StatusOK, map[string]any{"email": "a@b.co", "verified_email": true}),
		"no email":         jsonAnswer(http.StatusOK, map[string]any{"id": "1", "verified_email": true}),
		"unverified email": jsonAnswer(http.StatusOK, map[string]any{"id": "1", "email": "a@b.co", "verified_email": false}),
		"not json":         func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("<html>")) },
	}
	for name, answer := range cases {
		t.Run(name, func(t *testing.T) {
			newFakeGoogle(t, jsonAnswer(http.StatusOK, nil), answer)
			if info, err := getGoogleUserInfo(context.Background(), "some-token"); err == nil {
				t.Fatalf("must be refused, got a profile: %+v", info)
			}
		})
	}
	t.Run("empty token", func(t *testing.T) {
		g := newFakeGoogle(t, jsonAnswer(http.StatusOK, nil), jsonAnswer(http.StatusOK, goodProfile))
		if _, err := getGoogleUserInfo(context.Background(), ""); err == nil {
			t.Fatal("an empty token must be refused")
		}
		if g.userInfoCalls.Load() != 0 {
			t.Fatal("no call to Google for an empty token")
		}
	})
}

func TestUserInfoSendsTheTokenInAHeaderNotTheURL(t *testing.T) {
	newFakeGoogle(t, jsonAnswer(http.StatusOK, nil), func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer secret-token" {
			t.Errorf("Authorization header = %q", got)
		}
		if strings.Contains(r.URL.RawQuery, "secret-token") {
			t.Errorf("the token must not be in the URL: %q", r.URL.RawQuery)
		}
		jsonAnswer(http.StatusOK, goodProfile)(w, r)
	})
	info, err := getGoogleUserInfo(context.Background(), "secret-token")
	if err != nil || info.ID != "1234567890" || !info.VerifiedEmail {
		t.Fatalf("a verified profile must be returned: %+v, %v", info, err)
	}
}

func TestMobileTokenFromAnotherApplicationIsRefused(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", "our-web-client")
	t.Setenv("GOOGLE_MOBILE_CLIENT_IDS", "our-android-client, our-ios-client")
	g := newFakeGoogle(t, jsonAnswer(http.StatusOK, map[string]any{"aud": "someone-elses-app"}), jsonAnswer(http.StatusOK, goodProfile))

	if _, err := verifyGoogleMobileToken(context.Background(), "valid-but-foreign"); err != errGoogleAudience {
		t.Fatalf("err = %v, want errGoogleAudience", err)
	}
	if g.userInfoCalls.Load() != 0 {
		t.Fatal("the profile must not even be fetched for a foreign token")
	}
}

func TestMobileTokenOfOneOfOurClientsIsAccepted(t *testing.T) {
	for _, aud := range []string{"our-web-client", "our-android-client", "our-ios-client"} {
		t.Run(aud, func(t *testing.T) {
			t.Setenv("GOOGLE_CLIENT_ID", "our-web-client")
			t.Setenv("GOOGLE_MOBILE_CLIENT_IDS", "our-android-client, our-ios-client")
			newFakeGoogle(t, jsonAnswer(http.StatusOK, map[string]any{"aud": aud}), jsonAnswer(http.StatusOK, goodProfile))
			info, err := verifyGoogleMobileToken(context.Background(), "t")
			if err != nil || info.ID != "1234567890" {
				t.Fatalf("got %+v, %v", info, err)
			}
		})
	}
}

func TestMobileTokenRefusedWhenGoogleDoesNotKnowIt(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", "our-web-client")
	t.Setenv("GOOGLE_MOBILE_CLIENT_IDS", "")
	cases := map[string]http.HandlerFunc{
		"tokeninfo 400":  jsonAnswer(http.StatusBadRequest, map[string]any{"error": "invalid_token"}),
		"empty audience": jsonAnswer(http.StatusOK, map[string]any{}),
		"not json":       func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("nope")) },
	}
	for name, answer := range cases {
		t.Run(name, func(t *testing.T) {
			newFakeGoogle(t, answer, jsonAnswer(http.StatusOK, goodProfile))
			if _, err := verifyGoogleMobileToken(context.Background(), "garbage"); err == nil {
				t.Fatal("must be refused")
			}
		})
	}
}

func TestMobileSignInFailsClosedWithoutAConfiguredClient(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("GOOGLE_MOBILE_CLIENT_IDS", " , ")
	g := newFakeGoogle(t, jsonAnswer(http.StatusOK, map[string]any{"aud": ""}), jsonAnswer(http.StatusOK, goodProfile))
	if _, err := verifyGoogleMobileToken(context.Background(), "t"); err != errGoogleNoClient {
		t.Fatalf("err = %v, want errGoogleNoClient", err)
	}
	if g.tokenInfoCalls.Load() != 0 {
		t.Fatal("no call to Google when nothing is configured")
	}
}

// The handler is given a nil database: answering a bad token must happen before any user lookup or creation.
func TestMobileCallbackAnswersBadTokensBeforeTouchingTheDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ours := jsonAnswer(http.StatusOK, map[string]any{"aud": "our-web-client"})
	cases := []struct {
		name                string
		clientID            string
		tokenInfo, userInfo http.HandlerFunc
		want                int
	}{
		{"unknown token", "our-web-client", jsonAnswer(http.StatusBadRequest, map[string]any{"error": "invalid_token"}), jsonAnswer(http.StatusOK, goodProfile), http.StatusUnauthorized},
		{"foreign token", "our-web-client", jsonAnswer(http.StatusOK, map[string]any{"aud": "another-app"}), jsonAnswer(http.StatusOK, goodProfile), http.StatusUnauthorized},
		{"empty audience", "our-web-client", jsonAnswer(http.StatusOK, map[string]any{}), jsonAnswer(http.StatusOK, goodProfile), http.StatusUnauthorized},
		{"unverified e-mail", "our-web-client", ours, jsonAnswer(http.StatusOK, map[string]any{"id": "1", "email": "a@b.co", "verified_email": false}), http.StatusUnauthorized},
		{"empty profile", "our-web-client", ours, jsonAnswer(http.StatusOK, map[string]any{}), http.StatusUnauthorized},
		{"google outage on tokeninfo", "our-web-client", jsonAnswer(http.StatusServiceUnavailable, nil), jsonAnswer(http.StatusOK, goodProfile), http.StatusServiceUnavailable},
		{"google outage on userinfo", "our-web-client", ours, jsonAnswer(http.StatusInternalServerError, nil), http.StatusServiceUnavailable},
		{"nothing configured", "", ours, jsonAnswer(http.StatusOK, goodProfile), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("GOOGLE_CLIENT_ID", tc.clientID)
			t.Setenv("GOOGLE_MOBILE_CLIENT_IDS", "")
			newFakeGoogle(t, tc.tokenInfo, tc.userInfo)

			r := gin.New()
			r.POST("/mobile", GoogleMobileCallback(nil, []byte("jwt-secret")))
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/mobile", bytes.NewBufferString(`{"access_token":"not-a-real-token"}`))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)

			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tc.want, w.Body.String())
			}
			var body map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("body is not JSON: %v", err)
			}
			if _, issued := body["token"]; issued {
				t.Fatalf("no session may be issued: %s", w.Body.String())
			}
		})
	}
}

func TestMobileClassifiesGoogleFailures(t *testing.T) {
	t.Setenv("GOOGLE_CLIENT_ID", "our-web-client")
	t.Setenv("GOOGLE_MOBILE_CLIENT_IDS", "")
	for status, want := range map[int]error{http.StatusBadRequest: nil, http.StatusUnauthorized: nil, http.StatusInternalServerError: errGoogleUnavailable, http.StatusTooManyRequests: errGoogleUnavailable} {
		newFakeGoogle(t, jsonAnswer(status, map[string]any{}), jsonAnswer(http.StatusOK, goodProfile))
		_, err := verifyGoogleMobileToken(context.Background(), "t")
		if err == nil {
			t.Fatalf("status %d must be refused", status)
		}
		if got := errors.Is(err, errGoogleUnavailable); got != (want != nil) {
			t.Errorf("status %d: unavailable = %v, want %v (err %v)", status, got, want != nil, err)
		}
	}
}
