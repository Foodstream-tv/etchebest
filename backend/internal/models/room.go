package models

import (
	"github.com/lib/pq"
	"github.com/pion/webrtc/v3"
)

type TrackInfo struct {
	TrackID    uint `gorm:"primaryKey;autoIncrement"`
	LocalTrack *webrtc.TrackLocalStaticRTP
	Senders    []*webrtc.RTPSender
	Track      *webrtc.TrackRemote
}

type PeerConnection struct {
	PeerID  uint `gorm:"primaryKey;autoIncrement"`
	PeerCon *webrtc.PeerConnection
}

type ICECandidateInit struct {
	CandidateID uint `gorm:"primaryKey;autoIncrement"`
	Candidate   webrtc.ICECandidateInit
}

type Room struct {
	ID              string             `json:"id" gorm:"primaryKey"`
	Name            string             `json:"name"`
	Host            string             `json:"host"`
	Participants    pq.StringArray     `json:"participants" gorm:"type:text[]"`
	Viewers         int                `json:"viewers"`
	MaxParticipants int                `json:"maxParticipants" gorm:"default:5"`
	Connections []PeerConnection   `json:"-" gorm:"-"`
	Tracks      []*TrackInfo       `json:"-" gorm:"-"`
	PendingICE  []ICECandidateInit `json:"-" gorm:"-"`
}
