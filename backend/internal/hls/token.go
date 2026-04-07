package hls

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

type streamToken struct {
	ExpiresAt time.Time
}

var (
	tokens = make(map[string]map[string]streamToken)
)

func GenerateToken(roomID string, ttl time.Duration) string {
	b := make([]byte, 16)
	rand.Read(b)
	token := hex.EncodeToString(b)

	mu.Lock()
	defer mu.Unlock()

	if tokens[roomID] == nil {
		tokens[roomID] = make(map[string]streamToken)
	}

	tokens[roomID][token] = streamToken{
		ExpiresAt: time.Now().Add(ttl),
	}

	return token
}

func ValidateToken(roomID, token string) bool {
	mu.Lock()
	defer mu.Unlock()

	roomTokens := tokens[roomID]
	if roomTokens == nil {
		return false
	}

	data, ok := roomTokens[token]
	if !ok {
		return false
	}

	if time.Now().After(data.ExpiresAt) {
		delete(roomTokens, token)
		return false
	}

	return true
}
