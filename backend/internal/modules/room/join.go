package room

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/Foodstream-io/etchebest/internal/hls"
	liveModule "github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/gin-gonic/gin"
	"github.com/pion/sdp/v3"
	"github.com/pion/webrtc/v4"
	"gorm.io/gorm"
)

const (
	// maxCoStreamers is how many people besides the host can take part in a room. It is stored in
	// Room.MaxParticipants (default 5); this is the fallback for rooms created without it.
	maxCoStreamers = 5

	// maxSDPBytes bounds an SDP offer: a real one is a few KB, anything bigger is abuse.
	maxSDPBytes = 64 << 10
)

// slotLimit is the number of co-streamers (host excluded) the room accepts.
func slotLimit(room *Room) int {
	if room.MaxParticipants > 0 {
		return room.MaxParticipants
	}
	return maxCoStreamers
}

// coStreamerCount counts the registered participants other than the host.
func coStreamerCount(room *Room) int {
	n := 0
	for _, p := range room.Participants {
		if p != room.Host {
			n++
		}
	}
	return n
}

func isRegistered(room *Room, userID string) bool {
	if userID == "" {
		return false
	}
	if userID == room.Host {
		return true
	}
	for _, p := range room.Participants {
		if p == userID {
			return true
		}
	}
	return false
}

// joinableStatus reports whether a live in this status can still be joined.
func joinableStatus(status string) bool {
	return status == "scheduled" || status == "live"
}

// authorizeJoin decides whether userID may publish into the room: the host, or someone who
// reserved a place, while the live is scheduled or running. Nobody is added to the room here: a place
// is only taken by ReserveRoom (one code path, one limit). Writes the HTTP error and returns false
// when the caller must stop.
func authorizeJoin(c *gin.Context, db *gorm.DB, room *Room, userID string) bool {
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}

	// Participants / KickedUsers are shared with reserve, cancel, kick and disconnect.
	mu.Lock()
	kicked := room.KickedUsers != nil && room.KickedUsers[userID]
	registered := isRegistered(room, userID)
	roomID := room.ID
	mu.Unlock()

	if kicked {
		c.JSON(http.StatusForbidden, gin.H{"error": "you have been kicked from this room"})
		return false
	}
	if !registered {
		c.JSON(http.StatusForbidden, gin.H{"error": "you must register for this live before joining it"})
		return false
	}

	var live liveModule.Live
	recorded := true // no live row: assume the live is recorded, the safe side for the people in it
	if err := db.Select("status", "replay_disabled").Where("room_id = ?", roomID).First(&live).Error; err == nil {
		if !joinableStatus(live.Status) {
			c.JSON(http.StatusForbidden, gin.H{"error": "this live is over"})
			return false
		}
		recorded = !live.ReplayDisabled
	}

	// A recorded live may be replayed: a co-streamer must have agreed to it (the host chose it).
	if recorded && userID != room.Host {
		if ok, err := liveModule.HasConsented(db, roomID, userID); err != nil || !ok {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "you must agree to the recording of this live before joining it",
				"code":  codeRecordingConsentRequired,
			})
			return false
		}
	}
	return true
}

// codeRecordingConsentRequired is the machine-readable error clients use to show the consent step.
const codeRecordingConsentRequired = "RECORDING_CONSENT_REQUIRED"

// endHLS ends the room's HLS pipeline. A live whose host chose not to keep a replay has its recording
// deleted; otherwise the replay is generated. Returns the replay URL ("" when none is kept).
func endHLS(db *gorm.DB, roomID string) (string, error) {
	if !liveModule.IsRecorded(db, roomID) {
		hls.DiscardStream(roomID)
		return "", nil
	}
	return hls.StopStream(roomID)
}

var (
	errOfferTooLarge = errors.New("SDP offer too large")
	errOfferInvalid  = errors.New("invalid SDP offer")
)

// validateOffer checks an offer without touching any state: it must be an "offer" and a parsable SDP.
func validateOffer(offer webrtc.SessionDescription) error {
	if offer.Type != webrtc.SDPTypeOffer {
		return fmt.Errorf("%w: type must be offer", errOfferInvalid)
	}
	if offer.SDP == "" {
		return fmt.Errorf("%w: empty SDP", errOfferInvalid)
	}
	if len(offer.SDP) > maxSDPBytes {
		return errOfferTooLarge
	}
	var parsed sdp.SessionDescription
	if err := parsed.Unmarshal([]byte(offer.SDP)); err != nil {
		return fmt.Errorf("%w: %v", errOfferInvalid, err)
	}
	if len(parsed.MediaDescriptions) == 0 {
		return fmt.Errorf("%w: no media section", errOfferInvalid)
	}
	return nil
}

// readOffer reads and validates the SDP offer of a request, writing the HTTP error when it is bad.
func readOffer(c *gin.Context) (webrtc.SessionDescription, bool) {
	var offer webrtc.SessionDescription
	// Read one byte past the limit so an oversized body is told apart from a valid one.
	body, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, maxSDPBytes+4096))
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large"})
		return offer, false
	}
	if err := json.Unmarshal(body, &offer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid offer"})
		return offer, false
	}
	if err := validateOffer(offer); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, errOfferTooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return offer, false
	}
	return offer, true
}

// discardPeer forgets a peer connection that never made it to a working state (negotiation failed
// after it was registered) and closes it so its UDP sockets are released. Unlike onPeerDisconnected it
// does not end the live or free the user's place: the user did not leave, the attempt just failed.
func discardPeer(room *Room, pc *webrtc.PeerConnection) {
	mu.Lock()
	kept := room.Connections[:0:0]
	for _, conn := range room.Connections {
		if conn.PeerCon != pc {
			kept = append(kept, conn)
		}
	}
	room.Connections = kept
	room.Tracks = removeTracksFromPeer(room, pc)
	if room.HostPeerCon == pc {
		room.HostPeerCon = nil
	}
	mu.Unlock()
	closeDisconnectedPC(pc)
}
