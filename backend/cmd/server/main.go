package main

import (
	"fmt"
	"github.com/Foodstream-io/etchebest/internal/db"
	"github.com/Foodstream-io/etchebest/internal/modules/country"
	"github.com/Foodstream-io/etchebest/internal/modules/dish"
	"github.com/Foodstream-io/etchebest/internal/modules/live"
	"github.com/Foodstream-io/etchebest/internal/modules/room"
	"github.com/Foodstream-io/etchebest/internal/modules/tag"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"log"
	"os"

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

	r := gin.Default()
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

	webrtcIP := os.Getenv("WEBRTC_IP")
	if webrtcIP == "" {
		webrtcIP = "127.0.0.1" // default for local development
		log.Printf("WEBRTC_IP not set, defaulting to %s", webrtcIP)
	}

	var migrateModels = []any{
		&user.User{},
		&room.Room{},
		&country.Country{},
		&dish.Dish{},
		&live.Live{},
		&tag.Tag{},
	}

	if err := db.AutoMigrate(migrateModels...); err != nil {
		log.Fatal(err)
	}

	routes.Routes(r, db, jwtKey, stunServerURL, webrtcIP)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
