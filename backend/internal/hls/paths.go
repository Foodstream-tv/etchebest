package hls

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// Directories of the live HLS output and of the kept replays (relative to the working directory).
const (
	liveDir    = "./hls"
	replaysDir = "./storage/replays"
)

// ErrInvalidRoomID is returned for a room id that could not name a directory of its own.
var ErrInvalidRoomID = errors.New("invalid room id")

// Room ids are server-generated UUIDs; the tests use short ids like "room-1". Letters, digits, '-' and
// '_' only: no '.', '/' or '\', so a path built from an id can never leave its base directory.
var roomIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// roomDir returns the directory of roomID under base, or ErrInvalidRoomID.
func roomDir(base, roomID string) (string, error) {
	if strings.Contains(roomID, "..") || !roomIDPattern.MatchString(roomID) {
		return "", fmt.Errorf("%w: %q", ErrInvalidRoomID, roomID)
	}
	return filepath.Join(base, roomID), nil
}
