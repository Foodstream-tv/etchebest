package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	userModule "github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func verifyTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set: skipping the Postgres integration test")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS auth_verify_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=auth_verify_test"), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true})
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("JWT_SECRET", "test-jwt-secret") // the key hashSecret uses for the stored code hashes
	models := []any{&userModule.User{}, &userModule.VerificationCode{}, &userModule.PasswordResetToken{}}
	if err := db.Migrator().DropTable(models...); err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Migrator().DropTable(models...) })
	return db
}

func verifyRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/verify", VerifyCode(db, []byte("test-jwt-secret")))
	return r
}

func postVerify(r *gin.Engine, body map[string]string) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/verify", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func newAccount(t *testing.T, db *gorm.DB, id string, verified bool) userModule.User {
	t.Helper()
	u := userModule.User{
		ID: id, Email: id + "@example.com", Username: id, FirstName: "F", LastName: "L", Password: "hash",
		IsAccountVerified: verified, IsEmailVerified: verified,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	return u
}

func newCode(t *testing.T, db *gorm.DB, userID, code string) {
	t.Helper()
	vc := userModule.VerificationCode{
		ID: "code-" + userID, UserID: userID, CodeHash: hashSecret(purposeVerificationCode, code),
		Type: "email", Target: userID + "@example.com", ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := db.Create(&vc).Error; err != nil {
		t.Fatal(err)
	}
}

// Anybody can send an e-mail address or an ID: for an account that is already verified, no code can
// have been checked, so no session may come back.
func TestVerifyNeverSignsInAnAccountThatIsAlreadyVerified(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "already-verified", true)
	r := verifyRouter(db)

	for name, body := range map[string]map[string]string{
		"by e-mail": {"email": u.Email, "code": "000000"},
		"by id":     {"userId": u.ID, "code": "000000"},
	} {
		t.Run(name, func(t *testing.T) {
			w := postVerify(r, body)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (%s)", w.Code, w.Body.String())
			}
			var resp map[string]any
			_ = json.Unmarshal(w.Body.Bytes(), &resp)
			if _, signedIn := resp["token"]; signedIn {
				t.Fatalf("a session was issued without a code: %s", w.Body.String())
			}
			if len(w.Result().Cookies()) != 0 {
				t.Fatalf("a session cookie was set without a code: %v", w.Result().Cookies())
			}
		})
	}
}

func TestVerifyWithTheRightCodeSignsTheNewAccountIn(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "fresh", false)
	newCode(t, db, u.ID, "123456")

	w := postVerify(verifyRouter(db), map[string]string{"email": u.Email, "code": "123456"})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (%s)", w.Code, w.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["token"] == nil || resp["token"] == "" {
		t.Fatalf("the verified owner must get a session: %s", w.Body.String())
	}
	var got userModule.User
	db.First(&got, "id = ?", u.ID)
	if !got.IsAccountVerified {
		t.Fatal("the account must be verified")
	}
}

func TestVerifyRefusesAWrongCodeAndGivesNoSession(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "wrong", false)
	newCode(t, db, u.ID, "123456")

	w := postVerify(verifyRouter(db), map[string]string{"email": u.Email, "code": "654321"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	var got userModule.User
	db.First(&got, "id = ?", u.ID)
	if got.IsAccountVerified {
		t.Fatal("a wrong code must not verify the account")
	}
}

// Fifty guesses sent at once must not get more than the allowed attempts: the counter is taken atomically
// before the comparison, not updated afterwards from a value every request read before the others wrote.
func TestParallelGuessesAreLimitedToTheAllowedAttempts(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "brute", false)
	newCode(t, db, u.ID, "123456")
	r := verifyRouter(db)

	const guesses = 50
	var wg sync.WaitGroup
	answers := make([]string, guesses)
	start := make(chan struct{})
	for i := 0; i < guesses; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			w := postVerify(r, map[string]string{"email": u.Email, "code": "000000"})
			var resp map[string]string
			_ = json.Unmarshal(w.Body.Bytes(), &resp)
			answers[i] = resp["error"]
		}(i)
	}
	close(start)
	wg.Wait()

	compared := 0 // answers that only a real comparison with the code can give
	for _, a := range answers {
		if a == "invalid verification code" {
			compared++
		}
	}
	if compared != maxVerificationAttempts {
		t.Fatalf("%d guesses were compared against the code, exactly %d are allowed", compared, maxVerificationAttempts)
	}
	// Even the right code is refused once the attempts are spent.
	if w := postVerify(r, map[string]string{"email": u.Email, "code": "123456"}); w.Code == http.StatusOK {
		t.Fatalf("the right code after %d wrong ones must not work: %d", maxVerificationAttempts, w.Code)
	}
}

func TestTheCodeIsClosedOnceItsAttemptsAreSpent(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "spent", false)
	newCode(t, db, u.ID, "123456")
	r := verifyRouter(db)
	body := map[string]string{"email": u.Email, "code": "000000"}

	for i := 1; i <= maxVerificationAttempts; i++ {
		if w := postVerify(r, body); w.Code != http.StatusBadRequest {
			t.Fatalf("guess %d: status %d, want 400", i, w.Code)
		}
	}
	if w := postVerify(r, body); w.Code != http.StatusTooManyRequests {
		t.Fatalf("past the allowed attempts: status %d, want 429", w.Code)
	}
	var vc userModule.VerificationCode
	db.First(&vc, "user_id = ?", u.ID)
	if !vc.Used {
		t.Fatal("the code must be closed once its attempts are spent")
	}
	if w := postVerify(r, map[string]string{"email": u.Email, "code": "123456"}); w.Code == http.StatusOK {
		t.Fatalf("the right code is refused once the code is closed: %d", w.Code)
	}
}

func TestAnExpiredOrUsedCodeIsRefused(t *testing.T) {
	db := verifyTestDB(t)
	r := verifyRouter(db)

	expired := newAccount(t, db, "expired", false)
	newCode(t, db, expired.ID, "123456")
	db.Model(&userModule.VerificationCode{}).Where("user_id = ?", expired.ID).Update("expires_at", time.Now().Add(-time.Minute))
	if w := postVerify(r, map[string]string{"email": expired.Email, "code": "123456"}); w.Code != http.StatusBadRequest {
		t.Fatalf("an expired code: status %d, want 400", w.Code)
	}

	used := newAccount(t, db, "used", false)
	newCode(t, db, used.ID, "123456")
	db.Model(&userModule.VerificationCode{}).Where("user_id = ?", used.ID).Update("used", true)
	if w := postVerify(r, map[string]string{"email": used.Email, "code": "123456"}); w.Code != http.StatusBadRequest {
		t.Fatalf("a used code: status %d, want 400", w.Code)
	}
}

// Two requests with the right value must not both get a session out of one code. A barrier makes both
// read the code before either claims it, so the outcome does not depend on timing.
func TestOneCodeGivesOneSession(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "race", false)
	newCode(t, db, u.ID, "123456")

	var arrived atomic.Int32
	var barrier sync.WaitGroup
	barrier.Add(2)
	err := db.Callback().Query().After("gorm:query").Register("test:barrier", func(tx *gorm.DB) {
		if tx.Statement.Table == "verification_codes" && arrived.Add(1) <= 2 {
			barrier.Done()
			barrier.Wait()
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	r := verifyRouter(db)

	var wg sync.WaitGroup
	statuses := make([]int, 2)
	for i := range statuses {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			statuses[i] = postVerify(r, map[string]string{"email": u.Email, "code": "123456"}).Code
		}(i)
	}
	wg.Wait()

	ok := 0
	for _, s := range statuses {
		if s == http.StatusOK {
			ok++
		}
	}
	if ok != 1 {
		t.Fatalf("%d requests got a session from a single code, want exactly 1 (%v)", ok, statuses)
	}
}

// Resetting the password stamps the date the middleware compares sessions with, so every session issued
// before the reset (a stolen one, typically) stops working.
func TestResetPasswordRecordsTheDateThatEndsOldSessions(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "resetter", true)
	old := time.Now().Add(-time.Hour).Truncate(time.Second)
	if err := db.Model(&userModule.User{}).Where("id = ?", u.ID).UpdateColumn("password_updated_at", old).Error; err != nil {
		t.Fatal(err)
	}
	token := userModule.PasswordResetToken{
		ID: "rt-1", UserID: u.ID, Email: u.Email, TokenHash: hashSecret(purposeResetToken, "secret-token"),
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if err := db.Create(&token).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/reset-password", ResetPassword(db))
	raw, _ := json.Marshal(map[string]string{"token": "secret-token", "password": "new-password-9"})
	req := httptest.NewRequest(http.MethodPost, "/api/reset-password", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", w.Code, w.Body.String())
	}

	var got userModule.User
	db.First(&got, "id = ?", u.ID)
	if got.PasswordUpdatedAt == nil || !got.PasswordUpdatedAt.After(old.Add(30*time.Minute)) {
		t.Fatalf("password_updated_at = %v, want about now (was %v)", got.PasswordUpdatedAt, old)
	}
}

// Two requests with the same reset link must not both reset: the token is claimed atomically. A barrier makes both
// read it as unused before either claims it.
func TestOneResetLinkResetsOnce(t *testing.T) {
	db := verifyTestDB(t)
	u := newAccount(t, db, "twice", true)
	token := userModule.PasswordResetToken{
		ID: "rt-twice", UserID: u.ID, Email: u.Email, TokenHash: hashSecret(purposeResetToken, "secret-token"),
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	if err := db.Create(&token).Error; err != nil {
		t.Fatal(err)
	}

	var arrived atomic.Int32
	var barrier sync.WaitGroup
	barrier.Add(2)
	if err := db.Callback().Query().After("gorm:query").Register("test:reset-barrier", func(tx *gorm.DB) {
		if tx.Statement.Table == "password_reset_tokens" && arrived.Add(1) <= 2 {
			barrier.Done()
			barrier.Wait()
		}
	}); err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/reset-password", ResetPassword(db))
	statuses := make([]int, 2)
	var wg sync.WaitGroup
	for i := range statuses {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			raw, _ := json.Marshal(map[string]string{"token": "secret-token", "password": "new-password-9"})
			req := httptest.NewRequest(http.MethodPost, "/api/reset-password", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			statuses[i] = w.Code
		}(i)
	}
	wg.Wait()

	ok := 0
	for _, s := range statuses {
		if s == http.StatusOK {
			ok++
		}
	}
	if ok != 1 {
		t.Fatalf("%d requests reset the password with one link, want exactly 1 (%v)", ok, statuses)
	}
}
