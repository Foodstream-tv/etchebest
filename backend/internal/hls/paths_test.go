package hls

import (
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func TestRoomDirAcceptsServerIDs(t *testing.T) {
	for _, id := range []string{"6f1c2b9e-3d4a-4f5b-8c7d-0e1f2a3b4c5d", "room-1", "room_end_norec"} {
		dir, err := roomDir(liveDir, id)
		if err != nil {
			t.Fatalf("roomDir(%q) refused a valid id: %v", id, err)
		}
		if dir != filepath.Join(liveDir, id) {
			t.Fatalf("roomDir(%q) = %q", id, dir)
		}
	}
}

func TestRoomDirRefusesIDsThatLeaveTheBase(t *testing.T) {
	for _, id := range []string{"", ".", "..", "../etc", "a/../../b", "a/b", `a\b`, "/abs", "room.1", strings.Repeat("a", 65)} {
		if _, err := roomDir(replaysDir, id); !errors.Is(err, ErrInvalidRoomID) {
			t.Fatalf("roomDir(%q) should be refused, got err=%v", id, err)
		}
	}
}

func TestGenerateReplayRefusesAnInvalidRoomID(t *testing.T) {
	if _, err := GenerateReplay("../../etc"); !errors.Is(err, ErrInvalidRoomID) {
		t.Fatalf("GenerateReplay with a traversal id: err=%v, want ErrInvalidRoomID", err)
	}
}
