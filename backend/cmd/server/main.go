package main

import (
	"context"
	"fmt"
	"github.com/Foodstream-io/etchebest/internal/db"
	"github.com/Foodstream-io/etchebest/internal/middleware"
	"github.com/Foodstream-io/etchebest/internal/modules/account"
	"github.com/Foodstream-io/etchebest/internal/modules/activity"
	"github.com/Foodstream-io/etchebest/internal/modules/audit"
	"github.com/Foodstream-io/etchebest/internal/modules/chat"
	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/room"
	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"log"
	"net"
	"os"
	"time"

	_ "github.com/Foodstream-io/etchebest/docs"
	"github.com/Foodstream-io/etchebest/internal/routes"
	"github.com/gin-gonic/gin"
)

// @title           Etchebest API
// @version         1.0
// @description     API for Etchebest video streaming platform
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.email  mohamme@molaryy.fr

// @host      localhost:8081
// @BasePath  /

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.
func main() {
	db, err := db.InitDB()
	if err != nil {
		log.Fatal(err)
	}

	// Same as gin.Default() but the access log never contains query strings (the WebSocket token).
	r := gin.New()
	r.Use(middleware.AccessLogger(), gin.Recovery())
	if err := r.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}

	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		log.Fatal("BACKEND_PORT is not set in the environment")
	}

	fmt.Printf("Listening on port %s\n", port)
	jwtKey := os.Getenv("JWT_SECRET")
	if jwtKey == "" {
		log.Fatal("JWT_SECRET is not set in the environment")
	}

	stunServerURL := os.Getenv("STUN_SERVER_URL")
	if stunServerURL == "" {
		log.Fatal("STUN_SERVER_URL env variable not set")
	}

	if err := room.ValidateWebRTCConfig(); err != nil {
		log.Fatalf("invalid WebRTC configuration: %v", err)
	}

	webrtcIP := os.Getenv("WEBRTC_IP")
	if webrtcIP == "" {
		webrtcIP = "127.0.0.1" // default for local development
		log.Printf("WEBRTC_IP not set, defaulting to %s", webrtcIP)
	}
	// Remote clients (phones, other PCs) can only reach the media server through this address:
	// with a loopback value ICE succeeds only for a browser on the same machine and fails silently
	// for everybody else.
	if ip := net.ParseIP(webrtcIP); ip != nil && ip.IsLoopback() {
		log.Printf("WARNING: WEBRTC_IP=%s is a loopback address. Only clients running on this machine can "+
			"publish or watch over WebRTC. Set WEBRTC_IP to the server's LAN or public IP for phones and other devices.", webrtcIP)
	}

	var migrateModels = []any{
		&user.User{},
		&user.VerificationCode{},
		&user.PasswordResetToken{},
		&room.Room{},
		&country.Country{},
		&dish.Dish{},
		&live.Live{},
		&tag.Tag{},
		&chat.Chat{},
		&activity.Activity{},
		&audit.Entry{},
	}

	if err := db.AutoMigrate(migrateModels...); err != nil {
		log.Fatal(err)
	}

	// Ensure case-insensitive unique indexes on users
	_ = db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));").Error
	_ = db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_username ON users (LOWER(username));").Error

	// Ensure ADMIN accounts are verified
	db.Model(&user.User{}).Where("role = ? AND is_account_verified = ?", user.ADMIN, false).Update("is_account_verified", true)

	// One-time codes and reset tokens hold the email address: do not keep them once useless.
	if n, err := account.DiscardLegacySecrets(db); err != nil {
		log.Printf("[PURGE] legacy clear-text codes: %v", err)
	} else if n > 0 {
		log.Printf("[PURGE] discarded %d verification code(s) / reset token(s) stored in clear", n)
	}
	audit.StartPurgeLoop(context.Background(), db, 24*time.Hour)
	account.StartPurgeLoop(context.Background(), db, time.Hour)
	// Free the slots of people who reserved or started joining a running live and never connected.
	room.StartGhostReaper(context.Background(), db, 30*time.Second)

	routes.Routes(r, db, jwtKey, stunServerURL, webrtcIP)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
