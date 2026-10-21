package auth

import "testing"

func TestHashSecretIsStableKeyedAndPurposeBound(t *testing.T) {
	t.Setenv("JWT_SECRET", "key-one")
	a := hashSecret(purposeVerificationCode, "123456")
	if a != hashSecret(purposeVerificationCode, "123456") {
		t.Fatal("the hash must be deterministic")
	}
	if len(a) != 64 {
		t.Fatalf("hash length %d, want 64 (the legacy purge relies on it)", len(a))
	}
	if a == "123456" {
		t.Fatal("the secret must not be stored as is")
	}
	if a == hashSecret(purposeResetToken, "123456") {
		t.Error("a code hash must not be valid as a reset token hash")
	}
	if a == hashSecret(purposeVerificationCode, "123457") {
		t.Error("two different codes share a hash")
	}
	t.Setenv("JWT_SECRET", "key-two")
	if a == hashSecret(purposeVerificationCode, "123456") {
		t.Error("the hash must depend on the server key, or a leaked table reveals every code")
	}
}

func TestSecretMatches(t *testing.T) {
	t.Setenv("JWT_SECRET", "key-one")
	stored := hashSecret(purposeResetToken, "token-abc")
	if !secretMatches(purposeResetToken, "token-abc", stored) {
		t.Error("the right secret must match")
	}
	for _, bad := range []string{"", "token-abd", "token-abc ", stored} {
		if secretMatches(purposeResetToken, bad, stored) {
			t.Errorf("%q must not match", bad)
		}
	}
	if secretMatches(purposeVerificationCode, "token-abc", stored) {
		t.Error("a secret must not match under another purpose")
	}
}
