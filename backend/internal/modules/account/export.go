package account

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

// Export is everything the platform holds about one user, in a portable format (GDPR art. 15 and 20).
// The password hash and internal tokens are deliberately left out.
type Export struct {
	GeneratedAt time.Time        `json:"generatedAt"`
	Profile     ProfileExport    `json:"profile"`
	FollowingID []string         `json:"followingIds"`
	FollowersID []string         `json:"followersIds"`
	Lives       []LiveExport     `json:"lives"`
	ChatMessage []ChatExport     `json:"chatMessages"`
	Received    []ActivityExport `json:"notificationsReceived"`
	Performed   []ActivityExport `json:"actionsPerformed"`
}

type ProfileExport struct {
	ID                 string     `json:"id"`
	Email              string     `json:"email"`
	FirstName          string     `json:"firstName"`
	LastName           string     `json:"lastName"`
	Username           string     `json:"username"`
	ProfileImageURL    string     `json:"profileImageUrl"`
	Description        string     `json:"description"`
	CountryNumberPhone int        `json:"countryNumberPhone"`
	NumberPhone        string     `json:"numberPhone"`
	Role               string     `json:"role"`
	OAuthProvider      *string    `json:"oauthProvider"`
	IsEmailVerified    bool       `json:"isEmailVerified"`
	IsPhoneVerified    bool       `json:"isPhoneVerified"`
	IsBanned           bool       `json:"isBanned"`
	BanReason          string     `json:"banReason,omitempty"`
	BannedAt           *time.Time `json:"bannedAt,omitempty"`
	BannedUntil        *time.Time `json:"bannedUntil,omitempty"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
	PasswordUpdatedAt  *time.Time `json:"passwordUpdatedAt"`
}

type LiveExport struct {
	ID          uint       `json:"id"`
	RoomID      string     `json:"roomId"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	DishName    string     `json:"dishName"`
	Status      string     `json:"status"`
	ScheduledAt *time.Time `json:"scheduledAt,omitempty"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	EndedAt     *time.Time `json:"endedAt,omitempty"`
	HasReplay   bool       `json:"hasReplay"`
	ReplayURL   string     `json:"replayUrl,omitempty"`
	Duration    int        `json:"duration"`
	ViewCount   int        `json:"viewCount"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type ChatExport struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"roomId"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

type ActivityExport struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	ActorID   string    `json:"actorId"`
	Type      string    `json:"type"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

// BuildExport collects the user's data. Lists are never nil so the JSON always has arrays.
func BuildExport(db *gorm.DB, userID string) (*Export, error) {
	out := &Export{
		GeneratedAt: time.Now().UTC(),
		FollowingID: []string{},
		FollowersID: []string{},
		Lives:       []LiveExport{},
		ChatMessage: []ChatExport{},
		Received:    []ActivityExport{},
		Performed:   []ActivityExport{},
	}

	res := db.Table("users").Where("id = ?", userID).Take(&out.Profile)
	if res.Error != nil {
		return nil, res.Error
	}

	var following, followers pq.StringArray
	if err := db.Table("users").Select("following_id_s, followers_id_s").Where("id = ?", userID).
		Row().Scan(&following, &followers); err != nil {
		return nil, err
	}
	out.FollowingID = append(out.FollowingID, following...)
	out.FollowersID = append(out.FollowersID, followers...)

	if err := db.Table("lives").
		Select("id, room_id, title, description, dish_name, status, scheduled_at, started_at, ended_at, has_replay, replay_url, duration, view_count, created_at").
		Where("user_id = ?", userID).Order("created_at ASC").Scan(&out.Lives).Error; err != nil {
		return nil, err
	}
	if err := db.Table("chats").
		Select("id, room_id, message, created_at").
		Where("user_id = ?", userID).Order("created_at ASC").Scan(&out.ChatMessage).Error; err != nil {
		return nil, err
	}
	if err := db.Table("activities").Where("user_id = ?", userID).Order("created_at ASC").Scan(&out.Received).Error; err != nil {
		return nil, err
	}
	if err := db.Table("activities").Where("actor_id = ?", userID).Order("created_at ASC").Scan(&out.Performed).Error; err != nil {
		return nil, err
	}
	return out, nil
}
