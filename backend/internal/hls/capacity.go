package hls

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"sync"
)

// FFmpeg shares the machine with the API and the media server: a live costs one decode and several
// x264 encodes. The number of lives with HLS is bounded, and past a threshold new lives get a lighter
// ladder instead of taking the CPU the SFU needs.
const (
	defaultMaxLives        = 4
	defaultFullLadderLives = 2
)

// ErrTooManyLives means the HLS pipeline is full: the live goes on over WebRTC, without HLS or replay.
var ErrTooManyLives = errors.New("too many simultaneous HLS lives")

type capacityPolicy struct {
	maxLives        int // 0: unlimited
	fullLadderLives int // lives above this count get the light ladder
}

func envCount(name string, def int) (int, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return def, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 0 {
		return 0, fmt.Errorf("%s=%q is not a count (0 or more)", name, raw)
	}
	return v, nil
}

func loadCapacityPolicy() (capacityPolicy, error) {
	maxLives, err := envCount("HLS_MAX_LIVES", defaultMaxLives)
	if err != nil {
		return capacityPolicy{}, err
	}
	full, err := envCount("HLS_FULL_LADDER_LIVES", defaultFullLadderLives)
	if err != nil {
		return capacityPolicy{}, err
	}
	if maxLives > 0 && full > maxLives {
		return capacityPolicy{}, fmt.Errorf("HLS_FULL_LADDER_LIVES (%d) cannot exceed HLS_MAX_LIVES (%d)", full, maxLives)
	}
	return capacityPolicy{maxLives: maxLives, fullLadderLives: full}, nil
}

var (
	slotsMu sync.Mutex
	slots   = map[string]Ladder{} // room -> ladder, for every live holding a slot (starting or running)
)

// reserveSlot books a place for the room and picks its ladder from the current load. The returned
// release gives the place back; it is safe to call more than once.
func reserveSlot(roomID string) (Ladder, func(), error) {
	policy, err := loadCapacityPolicy()
	if err != nil {
		return Ladder{}, nil, err
	}
	slotsMu.Lock()
	defer slotsMu.Unlock()

	if _, held := slots[roomID]; held {
		return Ladder{}, nil, fmt.Errorf("room %s already has an HLS pipeline", roomID)
	}
	active := len(slots)
	if policy.maxLives > 0 && active >= policy.maxLives {
		return Ladder{}, nil, ErrTooManyLives
	}
	ladder := FullLadder
	if active >= policy.fullLadderLives {
		ladder = LightLadder
	}
	slots[roomID] = ladder

	var once sync.Once
	return ladder, func() {
		once.Do(func() {
			slotsMu.Lock()
			delete(slots, roomID)
			slotsMu.Unlock()
		})
	}, nil
}

// ActiveLives is how many lives currently hold an HLS slot.
func ActiveLives() int {
	slotsMu.Lock()
	defer slotsMu.Unlock()
	return len(slots)
}
