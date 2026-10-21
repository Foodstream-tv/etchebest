package room

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"sync"

	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"
)

const (
	defaultPortMin = 50000
	defaultPortMax = 50100
)

// webrtcPorts is where media sockets are opened: either one shared port (WEBRTC_UDP_MUX_PORT, every
// peer connection multiplexed on it) or a range (WEBRTC_PORT_MIN..WEBRTC_PORT_MAX, one port per peer).
type webrtcPorts struct {
	portMin, portMax uint16
	muxPort          uint16 // 0: use the range
}

func envPort(name string) (uint16, bool, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return 0, false, nil
	}
	v, err := strconv.ParseUint(raw, 10, 16)
	if err != nil || v == 0 {
		return 0, false, fmt.Errorf("%s=%q is not a valid port (1-65535)", name, raw)
	}
	return uint16(v), true, nil
}

// loadWebRTCPorts reads and checks the port configuration.
func loadWebRTCPorts() (webrtcPorts, error) {
	cfg := webrtcPorts{portMin: defaultPortMin, portMax: defaultPortMax}
	if v, ok, err := envPort("WEBRTC_PORT_MIN"); err != nil {
		return cfg, err
	} else if ok {
		cfg.portMin = v
	}
	if v, ok, err := envPort("WEBRTC_PORT_MAX"); err != nil {
		return cfg, err
	} else if ok {
		cfg.portMax = v
	}
	if cfg.portMin > cfg.portMax {
		return cfg, fmt.Errorf("WEBRTC_PORT_MIN (%d) is greater than WEBRTC_PORT_MAX (%d)", cfg.portMin, cfg.portMax)
	}
	if v, ok, err := envPort("WEBRTC_UDP_MUX_PORT"); err != nil {
		return cfg, err
	} else if ok {
		cfg.muxPort = v
	}
	return cfg, nil
}

// ValidateWebRTCConfig fails fast at startup on a bad port configuration instead of logging a warning
// and running with the wrong ports.
func ValidateWebRTCConfig() error {
	_, err := loadWebRTCPorts()
	return err
}

var (
	udpMuxOnce sync.Once
	udpMux     ice.UDPMux
	udpMuxErr  error
)

// sharedUDPMux opens the single UDP socket all peer connections share.
func sharedUDPMux(port uint16) (ice.UDPMux, error) {
	udpMuxOnce.Do(func() {
		conn, err := net.ListenUDP("udp", &net.UDPAddr{Port: int(port)})
		if err != nil {
			udpMuxErr = fmt.Errorf("cannot listen on the shared UDP port %d: %w", port, err)
			return
		}
		udpMux = webrtc.NewICEUDPMux(nil, conn)
	})
	return udpMux, udpMuxErr
}
