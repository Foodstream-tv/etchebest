package user

import (
	"encoding/json"
	"strings"
	"testing"
)

// The public representation of a user must never carry private data: it is what
// search, public profiles and follower lists return to any signed-in user.
func TestUserToDTODoesNotLeakPrivateFields(t *testing.T) {
	google := "google-123"
	u := User{
		ID:                 "u1",
		Email:              "secret@example.com",
		Password:           "hash",
		Username:           "chef",
		NumberPhone:        "0600000000",
		CountryNumberPhone: 33,
		BanReason:          "spam",
		GoogleID:           &google,
		FollowersIDS:       []string{"a"},
	}

	raw, err := json.Marshal(usersToDTOs([]User{u}))
	if err != nil {
		t.Fatal(err)
	}
	body := string(raw)

	for _, forbidden := range []string{"secret@example.com", "0600000000", "spam", "google-123", "hash", "email", "numberPhone", "googleId", "banReason"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("public DTO leaks %q: %s", forbidden, body)
		}
	}
	if !strings.Contains(body, `"username":"chef"`) || !strings.Contains(body, `"followersIds":["a"]`) {
		t.Fatalf("public DTO lost expected fields: %s", body)
	}
}
