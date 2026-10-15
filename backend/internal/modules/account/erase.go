// Package account implements the GDPR rights on a user account: erasure (art. 17)
// and access/portability (art. 15 and 20).
package account

import (
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"

	"gorm.io/gorm"
)

const (
	uploadsURLMarker = "/api/uploads/"
	uploadsDir       = "./storage/uploads"
	replaysDir       = "./storage/replays"
)

// ErrUserNotFound is returned when the account to erase does not exist.
var ErrUserNotFound = errors.New("user not found")

// EraseUser removes a user and every piece of personal data linked to them:
// profile, chat messages, notifications, verification codes and reset tokens, the user's
// ID in other users' follower lists and in rooms, hosted lives with their replay files,
// and the uploaded pictures. The database part is one transaction; files are removed after
// it commits (a missing file never fails the erasure).
//
// Limit: a replay hosted by someone else keeps showing the user if they were a co-streamer.
func EraseUser(db *gorm.DB, userID string) error {
	var files []string
	var replayRooms []string

	err := db.Transaction(func(tx *gorm.DB) error {
		var profile struct {
			ProfileImageURL string
		}
		res := tx.Table("users").Select("profile_image_url").Where("id = ?", userID).Take(&profile)
		if errors.Is(res.Error, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		if res.Error != nil {
			return res.Error
		}
		files = append(files, profile.ProfileImageURL)

		var lives []struct {
			ID           uint
			RoomID       string
			ThumbnailURL string
			PreviewGIF   string
		}
		if err := tx.Table("lives").
			Select("id, room_id, thumbnail_url, preview_gif").
			Where("user_id = ?", userID).Scan(&lives).Error; err != nil {
			return err
		}
		liveIDs := make([]uint, 0, len(lives))
		for _, l := range lives {
			liveIDs = append(liveIDs, l.ID)
			files = append(files, l.ThumbnailURL, l.PreviewGIF)
			if l.RoomID != "" {
				replayRooms = append(replayRooms, l.RoomID)
			}
		}
		if len(liveIDs) > 0 {
			if err := tx.Exec("DELETE FROM live_tags WHERE live_id IN ?", liveIDs).Error; err != nil {
				return err
			}
			if err := tx.Exec("DELETE FROM lives WHERE id IN ?", liveIDs).Error; err != nil {
				return err
			}
		}

		statements := []struct {
			sql  string
			args []any
		}{
			{"DELETE FROM chats WHERE user_id = ?", []any{userID}},
			{"DELETE FROM activities WHERE user_id = ? OR actor_id = ?", []any{userID, userID}},
			{"DELETE FROM verification_codes WHERE user_id = ?", []any{userID}},
			{"DELETE FROM password_reset_tokens WHERE user_id = ?", []any{userID}},
			{"DELETE FROM rooms WHERE host = ?", []any{userID}},
			{"UPDATE rooms SET participants = array_remove(participants, ?::text) WHERE ?::text = ANY(participants)", []any{userID, userID}},
			{`UPDATE users SET
				following_id_s = array_remove(following_id_s, ?::text),
				followers_id_s = array_remove(followers_id_s, ?::text),
				follower_count = COALESCE(cardinality(array_remove(followers_id_s, ?::text)), 0)
			  WHERE ?::text = ANY(following_id_s) OR ?::text = ANY(followers_id_s)`, []any{userID, userID, userID, userID, userID}},
			{"DELETE FROM users WHERE id = ?", []any{userID}},
		}
		for _, s := range statements {
			if err := tx.Exec(s.sql, s.args...).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	for _, f := range files {
		removeUploadedFile(f)
	}
	for _, roomID := range replayRooms {
		removeReplayDir(roomID)
	}
	return nil
}

// uploadFilename returns the file name when rawURL points at one of our uploads
// ("/api/uploads/<name>", with or without scheme and host); anything else (external
// pictures such as a Google avatar, empty values, path tricks) yields "".
func uploadFilename(rawURL string) string {
	i := strings.Index(rawURL, uploadsURLMarker)
	if i < 0 {
		return ""
	}
	name := rawURL[i+len(uploadsURLMarker):]
	if j := strings.IndexAny(name, "?#"); j >= 0 {
		name = name[:j]
	}
	if name == "" || name != filepath.Base(name) || name == "." || name == ".." {
		return ""
	}
	return name
}

func removeUploadedFile(rawURL string) {
	name := uploadFilename(rawURL)
	if name == "" {
		return
	}
	if err := os.Remove(filepath.Join(uploadsDir, name)); err != nil && !os.IsNotExist(err) {
		log.Printf("[ERASE] could not remove upload %s: %v", name, err)
	}
}

func removeReplayDir(roomID string) {
	if roomID == "" || roomID != filepath.Base(roomID) || roomID == "." || roomID == ".." {
		return
	}
	if err := os.RemoveAll(filepath.Join(replaysDir, roomID)); err != nil {
		log.Printf("[ERASE] could not remove replay %s: %v", roomID, err)
	}
}
