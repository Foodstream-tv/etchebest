package routes

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/internal/modules/discover"
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
	admin.GET("/users", user.GetAllUsers(db))
	admin.PATCH("/users/:userId", user.UpdateUserById(db))
	admin.DELETE("/users/:userId", user.DeleteUserById(db))
	api.GET("/users/me", user.GetMe(db))
	api.PATCH("/users/me", user.UpdateCurrentUser(db))
	api.POST("/users/follow/:userId", user.FollowUser(db))
	api.POST("/users/unfollow/:userId", user.UnfollowUser(db))

	// Rooms
	api.GET("/rooms", room.GetAllRooms(db))
	api.POST("/rooms", room.CreateNewRoom(db, room.DefaultRoomConfig))
	api.POST("/rooms/:roomId/reserve", room.ReserveRoom(db))
	api.POST("/rooms/participant", room.AddParticipant(db))
	api.POST("/rooms/:roomId/disconnect", room.HandleDisconnect(db))

	// WebRTC
	api.POST("/webrtc", room.HandleWebRTC(db, room.DefaultRoomConfig, stunServerURL, webrtcIP))
	api.POST("/ice", room.HandleICECandidate(db))

	// HLS - public access (video players can't send Authorization headers)
	r.Static("/api/hls", "./hls") // watch the stream -> video.src = `/api/hls/${roomId}/index.m3u8`;

	// Discover (public)
	r.GET("/api/discover", discover.GetDiscover(db))
	r.GET("/api/discover/categories", discover.GetCategories(db))
	r.GET("/api/discover/categories/:id/lives", discover.GetCategoryLives(db))

	// Not found
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"message": "the endpoint that you are trying to reach doesn't exist",
		})
	})
}
