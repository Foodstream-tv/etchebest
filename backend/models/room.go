package models

import (
	"github.com/lib/pq"
	"github.com/pion/webrtc/v3"
)

type TrackInfo struct {
	ID         uint `gorm:"primaryKey;autoIncrement"`
	LocalTrack *webrtc.TrackLocalStaticRTP
	Senders    []*webrtc.RTPSender
	Track      *webrtc.TrackRemote
}

type PeerConnection struct {
	ID      uint `gorm:"primaryKey;autoIncrement"`
	PeerCon *webrtc.PeerConnection
}

type ICECandidateInit struct {
	ID        uint `gorm:"primaryKey;autoIncrement"`
	Candidate webrtc.ICECandidateInit
}

type Room struct {
	ID              string             `json:"id" gorm:"primaryKey"`
	Name            string             `json:"name"`
	Host            string             `json:"host"`
	Participants    pq.StringArray     `json:"participants" gorm:"type:text[]"`
	Viewers         int                `json:"viewers"`
	MaxParticipants int                `json:"maxParticipants" gorm:"default:5"`
	Connections     []PeerConnection   `json:"connections" gorm:"foreignKey:ID;references:ID"`
	Tracks          []*TrackInfo       `json:"tracks" gorm:"foreignKey:ID;references:ID"`
	PendingICE      []ICECandidateInit `json:"pendingICE" gorm:"foreignKey:ID;references:ID"`
}
