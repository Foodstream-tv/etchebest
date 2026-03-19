package room

import (
	"github.com/Foodstream-io/etchebest/internal/hls"
	"github.com/lib/pq"
	"github.com/pion/webrtc/v3"
)

type TrackInfo struct {
	TrackID     uint `gorm:"primaryKey;autoIncrement"`
	// One LocalTrack per destination peer so each gets its own negotiated codec/PT
	LocalTracks map[*webrtc.PeerConnection]*webrtc.TrackLocalStaticRTP
	// PeerPT stores the negotiated payload type for each destination peer
	PeerPT      map[*webrtc.PeerConnection]uint8
	Senders     []*webrtc.RTPSender // kept for cleanup
	Track       *webrtc.TrackRemote
	SourcePC    *webrtc.PeerConnection
}

type PeerConnection struct {
	PeerID  uint `gorm:"primaryKey;autoIncrement"`
	UserID  string
	PeerCon *webrtc.PeerConnection
}

type Room struct {
	ID              string                    `json:"id" gorm:"primaryKey"`
	Name            string                    `json:"name"`
	Host            string                    `json:"host"`
	Participants    pq.StringArray            `json:"participants" gorm:"type:text[]" swaggertype:"array,string"`
	Viewers         int                       `json:"viewers"`
	MaxParticipants int                       `json:"maxParticipants" gorm:"default:5"`
	Connections     []PeerConnection          `json:"-" gorm:"-"`
	Tracks          []*TrackInfo              `json:"-" gorm:"-"`
	PendingICEByUser map[string][]webrtc.ICECandidateInit `json:"-" gorm:"-"`
	HLSWriter       *hls.HLSWriter            `json:"-" gorm:"-"`
	// HostPeerCon is the PeerConnection of the room host (publisher).
	// Only tracks received from this peer are relayed and fed to HLS.
	HostPeerCon     *webrtc.PeerConnection    `json:"-" gorm:"-"`
}
