// Package audit keeps a journal of what administrators do with other people's data: who consulted
// or changed what, and when. It stores identifiers and the route only, never request bodies or
// query strings (a search term or a ban reason is personal data too).
package audit

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Retention is how long entries are kept before the purge removes them.
const Retention = 365 * 24 * time.Hour

// Entry is one administrator action.
type Entry struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ActorID   string    `json:"actorId" gorm:"not null;index:idx_audit_actor"`
	Method    string    `json:"method" gorm:"not null"`
	Route     string    `json:"route" gorm:"not null"` // route pattern, e.g. /api/admin/users/:userId/ban
	TargetID  string    `json:"targetId"`              // the user, chat or room the route points at
	Status    int       `json:"status" gorm:"not null"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index:idx_audit_created"`
}

func (Entry) TableName() string { return "admin_audit_logs" }

func targetOf(c *gin.Context) string {
	for _, key := range []string{"userId", "chatId", "roomId"} {
		if v := c.Param(key); v != "" {
			return v
		}
	}
	return ""
}

// Middleware records every request of the group it is attached to, after the handler ran so the
// outcome (status) is known. Attach it after authentication so the actor is known.
func Middleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		entry := Entry{
			ID:       uuid.New().String(),
			ActorID:  c.GetString("userId"),
			Method:   c.Request.Method,
			Route:    c.FullPath(),
			TargetID: targetOf(c),
			Status:   c.Writer.Status(),
			IP:       c.ClientIP(),
		}
		if entry.ActorID == "" {
			return // never authenticated: nothing an administrator did
		}
		if err := db.Create(&entry).Error; err != nil {
			// The action already happened: say so loudly rather than fail the response.
			log.Printf("[AUDIT ERROR] could not record %s %s by %s: %v", entry.Method, entry.Route, entry.ActorID, err)
		}
	}
}

// List returns the most recent entries, optionally for one actor or target (?actorId=, ?targetId=),
// paged with ?limit= (default 50, max 200) and ?offset=.
func List(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		if limit < 1 || limit > 200 {
			limit = 50
		}
		offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
		if offset < 0 {
			offset = 0
		}

		q := db.Model(&Entry{})
		if v := c.Query("actorId"); v != "" {
			q = q.Where("actor_id = ?", v)
		}
		if v := c.Query("targetId"); v != "" {
			q = q.Where("target_id = ?", v)
		}

		var entries []Entry
		if err := q.Order("created_at desc").Limit(limit).Offset(offset).Find(&entries).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch audit log"})
			return
		}
		c.JSON(http.StatusOK, entries)
	}
}

// Purge deletes entries older than Retention and returns how many were removed.
func Purge(db *gorm.DB, now time.Time) (int64, error) {
	res := db.Where("created_at < ?", now.Add(-Retention)).Delete(&Entry{})
	return res.RowsAffected, res.Error
}

// StartPurgeLoop runs Purge once now, then every interval until ctx is cancelled.
func StartPurgeLoop(ctx context.Context, db *gorm.DB, interval time.Duration) {
	run := func() {
		n, err := Purge(db, time.Now())
		if err != nil {
			log.Printf("[PURGE] audit log: %v", err)
		} else if n > 0 {
			log.Printf("[PURGE] removed %d audit log entrie(s) older than a year", n)
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
