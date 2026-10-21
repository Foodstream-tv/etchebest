package hls

import (
	"fmt"
	"math/rand"
	"net"
	"os"
	"strconv"
	"sync"
)

// FFmpeg reads the media on loopback UDP ports. They come from a range of their own, away from the
// WebRTC media ports (WEBRTC_PORT_*, 50000-50100 by default) and from the OS ephemeral range, so the
// two can never grab each other's port.
const (
	defaultRTPPortMin = 40000
	defaultRTPPortMax = 40999
)

var (
	portsMu   sync.Mutex
	portsUsed = map[int]bool{}
)

type portRange struct{ min, max int }

func envInt(name string, def int) (int, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return def, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 1 || v > 65535 {
		return 0, fmt.Errorf("%s=%q is not a valid port (1-65535)", name, raw)
	}
	return v, nil
}

func loadPortRange() (portRange, error) {
	lo, err := envInt("HLS_RTP_PORT_MIN", defaultRTPPortMin)
	if err != nil {
		return portRange{}, err
	}
	hi, err := envInt("HLS_RTP_PORT_MAX", defaultRTPPortMax)
	if err != nil {
		return portRange{}, err
	}
	if hi-lo < 3 {
		return portRange{}, fmt.Errorf("HLS_RTP_PORT_MIN..HLS_RTP_PORT_MAX (%d..%d) must hold at least two RTP/RTCP pairs", lo, hi)
	}
	return portRange{lo, hi}, nil
}

// ValidateConfig fails fast at startup on a bad FFmpeg port range.
func ValidateConfig() error {
	if _, err := loadPortRange(); err != nil {
		return err
	}
	_, err := loadCapacityPolicy()
	return err
}

func canBind(port int) bool {
	l, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: port})
	if err != nil {
		return false
	}
	_ = l.Close()
	return true
}

// allocateRTPPorts reserves two RTP/RTCP port pairs (audio, video) from the dedicated range. The
// ports stay reserved until releasePorts, so two rooms starting together cannot be given the same one.
func allocateRTPPorts() (audio, video int, err error) {
	r, err := loadPortRange()
	if err != nil {
		return 0, 0, err
	}
	portsMu.Lock()
	defer portsMu.Unlock()

	pairs := (r.max - r.min + 1) / 2
	start := rand.Intn(pairs)
	var got []int
	for i := 0; i < pairs && len(got) < 2; i++ {
		port := r.min + ((start+i)%pairs)*2 // even port: RTP; port+1: RTCP
		if portsUsed[port] || !canBind(port) || !canBind(port+1) {
			continue
		}
		got = append(got, port)
		portsUsed[port] = true // reserved right away: the next candidate must not pick it
	}
	if len(got) < 2 {
		for _, p := range got {
			delete(portsUsed, p)
		}
		return 0, 0, fmt.Errorf("no free RTP/RTCP port pair left in %d..%d", r.min, r.max)
	}
	return got[0], got[1], nil
}

func releasePorts(ports ...int) {
	portsMu.Lock()
	defer portsMu.Unlock()
	for _, p := range ports {
		delete(portsUsed, p)
	}
}

func listenUDP(port int) (*net.UDPConn, error) {
	return net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: port})
}
