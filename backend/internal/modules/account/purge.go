package account

import (
	"context"
	"log"
	"time"

	"gorm.io/gorm"
)

// credentialGrace keeps expired or used codes and tokens a little while (support, debugging a
// "my code does not work" report) before they are deleted: they hold the user's email address.
const credentialGrace = 24 * time.Hour

// PurgeExpiredCredentials deletes verification codes and password reset tokens that are expired
// or used for more than credentialGrace, and returns how many rows were removed.
func PurgeExpiredCredentials(db *gorm.DB, now time.Time) (int64, error) {
	cutoff := now.Add(-credentialGrace)
	var total int64
	for _, table := range []string{"verification_codes", "password_reset_tokens"} {
		res := db.Exec("DELETE FROM "+table+" WHERE expires_at < ? OR (used = TRUE AND created_at < ?)", cutoff, cutoff)
		if res.Error != nil {
			return total, res.Error
		}
		total += res.RowsAffected
	}
	return total, nil
}

// StartPurgeLoop runs PurgeExpiredCredentials once now, then every interval until ctx is cancelled.
func StartPurgeLoop(ctx context.Context, db *gorm.DB, interval time.Duration) {
	run := func() {
		n, err := PurgeExpiredCredentials(db, time.Now())
		if err != nil {
			log.Printf("[PURGE] expired credentials: %v", err)
			return
		}
		if n > 0 {
			log.Printf("[PURGE] removed %d expired verification code(s) / reset token(s)", n)
		}
	}
	go func() {
		run()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				run()
			}
		}
	}()
}
