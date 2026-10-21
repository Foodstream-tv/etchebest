package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// wsTicketTTL is how long a freshly issued ticket can be redeemed. A browser opens the WebSocket
// right after asking for it.
const wsTicketTTL = 30 * time.Second

// WSTickets hands out short-lived, single-use tickets so the WebSocket handshake does not need the
// session token: browsers cannot set headers on a WebSocket, and a token in the URL ends up in logs,
// history and proxies. Tickets live in memory, which is fine for a single backend instance.
type WSTickets struct {
	mu      sync.Mutex
	tickets map[string]wsTicket
	now     func() time.Time
}

type wsTicket struct {
	userID  string
	expires time.Time
}

func NewWSTickets() *WSTickets {
	return &WSTickets{tickets: map[string]wsTicket{}, now: time.Now}
}

// Issue creates a ticket for userID.
func (s *WSTickets) Issue(userID string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	ticket := hex.EncodeToString(raw)

	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for k, t := range s.tickets { // forget tickets nobody redeemed
		if now.After(t.expires) {
			delete(s.tickets, k)
		}
	}
	s.tickets[ticket] = wsTicket{userID: userID, expires: now.Add(wsTicketTTL)}
	return ticket, nil
}

// Redeem returns the user a ticket was issued to and invalidates it, whether or not it was still valid.
func (s *WSTickets) Redeem(ticket string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.tickets[ticket]
	if !ok {
		return "", false
	}
	delete(s.tickets, ticket)
	if s.now().After(t.expires) {
		return "", false
	}
	return t.userID, true
}

// IssueWSTicket answers an authenticated request with a ticket for the WebSocket.
func IssueWSTicket(s *WSTickets) gin.HandlerFunc {
	return func(c *gin.Context) {
		ticket, err := s.Issue(c.GetString("userId"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue ticket"})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"ticket": ticket, "expiresInSec": int(wsTicketTTL.Seconds())})
	}
}

// WSTicketAuth authenticates a WebSocket handshake with the `ticket` query parameter.
func WSTicketAuth(s *WSTickets) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := s.Redeem(c.Query("ticket"))
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing, expired or already used ticket"})
			return
		}
		c.Set("userId", userID)
		c.Next()
	}
}
