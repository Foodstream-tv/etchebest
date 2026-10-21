package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestWSTicketIsSingleUse(t *testing.T) {
	s := NewWSTickets()
	ticket, err := s.Issue("alice")
	if err != nil || len(ticket) != 64 {
		t.Fatalf("ticket %q, err %v", ticket, err)
	}
	if uid, ok := s.Redeem(ticket); !ok || uid != "alice" {
		t.Fatalf("first redeem = %q, %v", uid, ok)
	}
	if _, ok := s.Redeem(ticket); ok {
		t.Fatal("a ticket must work only once")
	}
}

func TestWSTicketExpires(t *testing.T) {
	s := NewWSTickets()
	now := time.Now()
	s.now = func() time.Time { return now }
	ticket, _ := s.Issue("alice")
	s.now = func() time.Time { return now.Add(wsTicketTTL + time.Second) }
	if _, ok := s.Redeem(ticket); ok {
		t.Fatal("an expired ticket must be refused")
	}
	if len(s.tickets) != 0 {
		t.Fatal("a redeemed ticket must be forgotten even when expired")
	}
}

func TestWSTicketsAreUnique(t *testing.T) {
	s := NewWSTickets()
	a, _ := s.Issue("alice")
	b, _ := s.Issue("alice")
	if a == b {
		t.Fatal("two tickets are equal")
	}
	if _, ok := s.Redeem("nope"); ok {
		t.Fatal("an unknown ticket was accepted")
	}
}

func TestWSTicketAuthSetsTheUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	s := NewWSTickets()
	r := gin.New()
	r.GET("/ws", WSTicketAuth(s), func(c *gin.Context) { c.String(200, c.GetString("userId")) })

	ticket, _ := s.Issue("bob")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ws?ticket="+ticket, nil))
	if w.Code != 200 || w.Body.String() != "bob" {
		t.Fatalf("valid ticket: %d %q", w.Code, w.Body.String())
	}

	for name, url := range map[string]string{"reused": "/ws?ticket=" + ticket, "missing": "/ws", "a session token": "/ws?token=abc"} {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s: status %d, want 401", name, w.Code)
		}
	}
}
