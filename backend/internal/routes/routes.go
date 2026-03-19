package routes

import (
	"net/http"
	"os"

	"github.com/Foodstream-io/etchebest/internal/modules/room"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/Foodstream-io/etchebest/internal/auth"
	"github.com/Foodstream-io/etchebest/internal/middleware"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func Routes(r *gin.Engine, db *gorm.DB, jwtToken string, stunServerURL string, webrtcIP string) {
	r.Use(middleware.CorsHandler())
	bJwtToken := []byte(jwtToken)

	// Get OAuth configuration from environment
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	googleClientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	googleRedirectURI := os.Getenv("GOOGLE_REDIRECT_URI")

	// facebookAppID := os.Getenv("FACEBOOK_APP_ID")
	// facebookAppSecret := os.Getenv("FACEBOOK_APP_SECRET")
	// facebookRedirectURI := os.Getenv("FACEBOOK_REDIRECT_URI")

	// Health check / root endpoint
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Etchebest API is running",
			"version": "1.0",
		})
	})

	// Swagger documentation (public access)
	r.GET("/api/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware(bJwtToken))

	admin := api.Group("/admin")
	admin.Use(middleware.RequireRole(user.ADMIN))

	// Authentication
	r.POST("/api/register", auth.Register(db))
	r.POST("/api/login", auth.Login(db, bJwtToken))

	// OAuth endpoints (public access)
	if googleClientID != "" && googleClientSecret != "" && googleRedirectURI != "" {
		r.GET("/api/auth/google/callback", auth.GoogleCallback(db, bJwtToken, googleClientID, googleClientSecret, googleRedirectURI))
		r.POST("/api/auth/google/callback", auth.GoogleCallback(db, bJwtToken, googleClientID, googleClientSecret, googleRedirectURI))
	}

	// if facebookAppID != "" && facebookAppSecret != "" && facebookRedirectURI != "" {
	// 	r.GET("/api/auth/facebook/callback", auth.FacebookCallback(db, bJwtToken, facebookAppID, facebookAppSecret, facebookRedirectURI))
	// 	r.POST("/api/auth/facebook/callback", auth.FacebookCallback(db, bJwtToken, facebookAppID, facebookAppSecret, facebookRedirectURI))
	// }

	// User
	admin.GET("/users", user.GetAllUsers(db))
	admin.PATCH("/users/:userId", user.UpdateUserById(db))
	admin.DELETE("/users/:userId", user.DeleteUserById(db))
	api.GET("/users/me", user.GetMe(db))
	api.PATCH("/users/me", user.UpdateCurrentUser(db))
	api.POST("/users/follow/:userId", user.FollowUser(db))
	api.POST("/users/unfollow/:userId", user.UnfollowUser(db))

	// Rooms
	api.GET("/rooms", room.GetAllRooms(db))
	api.POST("/rooms", room.CreateNewRoom(db))
	api.POST("/rooms/:roomId/reserve", room.ReserveRoom(db))
	api.POST("/rooms/participant", room.AddParticipant(db))
	api.POST("/rooms/:roomId/disconnect", room.HandleDisconnect(db))

	// WebRTC
	api.POST("/webrtc", room.HandleWebRTC(db, stunServerURL, webrtcIP))
	api.POST("/ice", room.HandleICECandidate(db))

	// HLS - public access (video players can't send Authorization headers)
	r.Static("/api/hls", "./hls") // watch the stream -> video.src = `/api/hls/${roomId}/index.m3u8`;

	// Not found
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"message": "the endpoint that you are trying to reach doesn't exist",
		})
	})
}
