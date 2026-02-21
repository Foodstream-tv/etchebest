package main

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/models"
	"github.com/Foodstream-io/etchebest/users"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/Foodstream-io/etchebest/auth"
	"github.com/Foodstream-io/etchebest/middleware"
	"github.com/Foodstream-io/etchebest/rooms"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func routes(r *gin.Engine, db *gorm.DB, jwtToken string) {
	r.Use(middleware.CorsHandler())
	bJwtToken := []byte(jwtToken)

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware(bJwtToken))

	admin := api.Group("/admin")
	admin.Use(middleware.RequireRole(models.ADMIN))

	// Authentication
	r.POST("/api/register", auth.Register(db))
	r.POST("/api/login", auth.Login(db, bJwtToken))

	// User
	admin.GET("/users", users.GetUsers(db))
	admin.PATCH("/users/:userId", users.UpdateUser(db))
	api.GET("/users/me", users.GetMe(db))
	api.PATCH("/users/me", users.UpdateCurrentUser(db))
	api.POST("/users/follow/:userId", users.FollowUser(db))
	api.POST("/users/unfollow/:userId", users.UnfollowUser(db))

	// Rooms
	api.GET("/rooms", rooms.GetRooms(db))
	api.POST("/rooms", rooms.CreateRoom(db))
	api.POST("/rooms/reserve", rooms.ReserveRoom(db))
	api.POST("/rooms/participant", rooms.AddParticipant(db))
	api.POST("/rooms/disconnect", rooms.HandleDisconnect(db))

	// WebRTC
	api.POST("/webrtc", rooms.HandleWebRTC(db))
	api.POST("/ice", rooms.HandleICECandidate(db))

	// Swagger
	api.GET("swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Not found
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"message": "the endpoint that you are trying to reach doesn't exist",
		})
	})
}
