package room

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRoomCapacityLimit(t *testing.T) {
	room := &Room{
		ID:              "test-room-id",
		Name:            "Test Live Cooking Room",
		Host:            "host-user-id",
		Participants:    pq.StringArray{"host-user-id"},
		Viewers:         0,
		MaxParticipants: 5,
	}

	if room.MaxParticipants != 5 {
		t.Fatalf("expected MaxParticipants to be 5, got %d", room.MaxParticipants)
	}

	// Add 4 more participants to reach maximum of 5
	for i := 1; i <= 4; i++ {
		userID := fmt.Sprintf("participant-%d", i)
		if len(room.Participants) >= room.MaxParticipants {
			t.Fatalf("should not be full yet at %d participants", len(room.Participants))
		}
		room.Participants = append(room.Participants, userID)
	}

	if len(room.Participants) != 5 {
		t.Fatalf("expected 5 participants, got %d", len(room.Participants))
	}

	// Now try to add a 6th participant
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	if len(room.Participants) >= room.MaxParticipants {
		c.JSON(http.StatusForbidden, gin.H{"error": "room is full"})
	}

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden for 6th participant, got %d", w.Code)
	}
}

func TestH264IsCompatible(t *testing.T) {
	srcFmtp := "packetization-mode=1;profile-level-id=42e01f;level-asymmetry-allowed=1"
	dstFmtp := "profile-level-id=42e01f;packetization-mode=1"

	if !h264IsCompatible(srcFmtp, dstFmtp) {
		t.Fatal("expected H264 fmtp to be compatible with same packetization-mode and profile-level-id")
	}

	incompatibleFmtp := "packetization-mode=0;profile-level-id=42e01f"
	if h264IsCompatible(srcFmtp, incompatibleFmtp) {
		t.Fatal("expected H264 fmtp with different packetization-mode to be incompatible")
	}

	incompatibleProfile := "packetization-mode=1;profile-level-id=64001f"
	if h264IsCompatible(srcFmtp, incompatibleProfile) {
		t.Fatal("expected H264 fmtp with different profile-level-id to be incompatible")
	}
}

func TestNormalizeFmtp(t *testing.T) {
	fmtp1 := "profile-level-id=42e01f; packetization-mode=1"
	fmtp2 := "packetization-mode=1;profile-level-id=42e01f"

	norm1 := normalizeFmtp(fmtp1)
	norm2 := normalizeFmtp(fmtp2)

	if norm1 != norm2 {
		t.Fatalf("expected normalized fmtp strings to match: %q vs %q", norm1, norm2)
	}
}
