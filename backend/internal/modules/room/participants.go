package room

import (
	"context"
	"log"
	"time"

	"gorm.io/gorm"
)

// ghostGrace is how long a participant who never connected (a reservation, or a join that did not
// reach WebRTC) keeps a slot of a live that is already running. Measured from the later of the
// moment they were added and the moment the host went live, so reservations made for a scheduled
// live get this time to join after it starts.
const ghostGrace = 3 * time.Minute

// ParticipantInfo is what a client can show about someone in a room: a name, not an id.
type ParticipantInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	// Role is "host" or "participant".
	Role string `json:"role"`
	// Connected is true while the user has an active peer connection in the room.
	Connected bool `json:"connected"`
}

// RoomView is the room as the API returns it: the stored room plus who is in it.
type RoomView struct {
	Room
	ParticipantsInfo []ParticipantInfo `json:"participantsInfo"`
	// ConnectedCount counts the co-streamers (host excluded) with an active peer connection.
	ConnectedCount int `json:"connectedCount"`
}

// connectedUsers returns the users that have a peer connection in the in-memory room.
// Must be called with mu held. A nil room (not live in memory) has nobody connected.
func connectedUsers(room *Room) map[string]bool {
	connected := make(map[string]bool)
	if room == nil {
		return connected
	}
	for _, c := range room.Connections {
		if c.PeerCon != nil && c.UserID != "" {
			connected[c.UserID] = true
		}
	}
	return connected
}

// newRoomView builds the API view. names maps a user id to a username; an unknown id gets an empty
// username (the client must not show the id).
func newRoomView(room *Room, connected map[string]bool, names map[string]string) RoomView {
	view := RoomView{Room: *room, ParticipantsInfo: make([]ParticipantInfo, 0, len(room.Participants))}
	for _, id := range room.Participants {
		role := "participant"
		if id == room.Host {
			role = "host"
		}
		isConnected := connected[id]
		view.ParticipantsInfo = append(view.ParticipantsInfo, ParticipantInfo{ID: id, Username: names[id], Role: role, Connected: isConnected})
		if isConnected && id != room.Host {
			view.ConnectedCount++
		}
	}
	return view
}

// usernamesByID resolves usernames for the given user ids.
func usernamesByID(db *gorm.DB, ids []string) map[string]string {
	names := make(map[string]string, len(ids))
	if len(ids) == 0 {
		return names
	}
	var rows []struct {
		ID       string
		Username string
	}
	if err := db.Table("users").Select("id, username").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		log.Printf("could not resolve participant usernames: %v", err)
		return names
	}
	for _, r := range rows {
		names[r.ID] = r.Username
	}
	return names
}

// markPending notes when a non-host user took a slot without being connected yet.
// Must be called with mu held.
func markPending(room *Room, userID string, now time.Time) {
	if room == nil || userID == "" || userID == room.Host {
		return
	}
	if room.PendingSince == nil {
		room.PendingSince = make(map[string]time.Time)
	}
	room.PendingSince[userID] = now
}

// ghostParticipants returns the participants who hold a slot of a running live without being
// connected for longer than grace. The host is never a ghost, and nothing is reaped while the host
// is not connected (a scheduled live keeps its reservations). Must be called with mu held.
func ghostParticipants(room *Room, now time.Time, grace time.Duration) []string {
	if room == nil || room.HostPeerCon == nil {
		return nil
	}
	connected := connectedUsers(room)
	var ghosts []string
	for _, id := range room.Participants {
		if id == room.Host || connected[id] {
			continue
		}
		since := room.PendingSince[id]
		if room.HostConnectedAt.After(since) {
			since = room.HostConnectedAt
		}
		if since.IsZero() {
			// No reference moment at all: start counting now rather than reaping blindly.
			markPending(room, id, now)
			continue
		}
		if now.Sub(since) > grace {
			ghosts = append(ghosts, id)
		}
	}
	return ghosts
}

// ReapGhostParticipants frees the slots held by ghosts in every live room and returns how many were freed.
func ReapGhostParticipants(db *gorm.DB, now time.Time, grace time.Duration) int {
	liveRoomsMu.Lock()
	rooms := make([]*Room, 0, len(liveRooms))
	for _, r := range liveRooms {
		rooms = append(rooms, r)
	}
	liveRoomsMu.Unlock()

	freed := 0
	for _, r := range rooms {
		mu.Lock()
		for _, id := range ghostParticipants(r, now, grace) {
			log.Printf("room %s: freeing the slot of participant %s who never connected", r.ID, id)
			removeParticipantState(db, r, id)
			freed++
		}
		mu.Unlock()
	}
	return freed
}

// StartGhostReaper runs ReapGhostParticipants every interval until ctx is cancelled.
func StartGhostReaper(ctx context.Context, db *gorm.DB, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ReapGhostParticipants(db, time.Now(), ghostGrace)
			}
		}
	}()
}
