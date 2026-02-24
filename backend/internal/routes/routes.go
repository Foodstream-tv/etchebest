package routes

import (
	"github.com/Foodstream-io/etchebest/internal/modules/room"
	"github.com/Foodstream-io/etchebest/internal/modules/user"
	"github.com/Foodstream-io/etchebest/internal/pages/streams"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"net/http"

	"github.com/Foodstream-io/etchebest/internal/auth"
	"github.com/Foodstream-io/etchebest/internal/middleware"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func Routes(r *gin.Engine, db *gorm.DB, jwtToken string, stunServerURL string) {
	r.Use(middleware.CorsHandler())
	bJwtToken := []byte(jwtToken)

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

	// User
	admin.GET("/users", user.GetUsers(db))
	admin.PATCH("/users/:userId", user.UpdateUser(db))
	api.GET("/users/me", user.GetMe(db))
	api.PATCH("/users/me", user.UpdateCurrentUser(db))
	api.POST("/users/follow/:userId", user.FollowUser(db))
	api.POST("/users/unfollow/:userId", user.UnfollowUser(db))

	// Rooms
	api.GET("/rooms", room.GetAllRooms(db))
	api.POST("/rooms", room.CreateNewRoom(db))
	api.POST("/rooms/reserve", room.ReserveRoom(db))
	api.POST("/rooms/participant", room.AddParticipant(db))
	api.POST("/rooms/disconnect", room.HandleDisconnect(db))

	// WebRTC
	api.POST("/webrtc", room.HandleWebRTC(db, stunServerURL))
	api.POST("/ice", room.HandleICECandidate(db))

	// Hls
	api.GET("/streams/:roomId/token", streams.GetLiveToken()) // ask a token first -> const res = await fetch(`/api/streams/${roomId}/token`);
	api.Static("/hls", "./hls")                               // watch the stream -> video.src = `/hls/${roomId}/index.m3u8?token=${token}`;

	// Not found
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"message": "the endpoint that you are trying to reach doesn't exist",
		})
	})
}
