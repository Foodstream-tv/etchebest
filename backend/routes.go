package main

import (
	"github.com/Foodstream-io/etchebest/users"
	"net/http"

	"github.com/Foodstream-io/etchebest/auth"
	"github.com/Foodstream-io/etchebest/middleware"
	"github.com/Foodstream-io/etchebest/rooms"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func routeNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{
		"message": "The endpoint that you are trying to reach doesn't exist",
	})
}

func Routes(r *gin.Engine, db *gorm.DB, jwtToken string) {
	r.Use(middleware.CorsHandler())
	bJwtToken := []byte(jwtToken)

	adminGroup := r.Group("/api/admin")
	adminGroup.Use(
		middleware.AuthMiddleware(bJwtToken),
		middleware.RequireRole("ADMIN"),
	)

	userGroup := r.Group("/api")
	userGroup.Use(
		middleware.AuthMiddleware(bJwtToken),
	)

	// Auth routes
	r.POST("/api/register", auth.Register(db))
	r.POST("/api/login", auth.Login(db, bJwtToken))

	// User routes
	adminGroup.GET("/users", users.GetUsers(db))
	userGroup.GET("/users/me", users.GetMe(db))
	userGroup.POST("/users/follow", users.FollowUser(db))
	userGroup.POST("/users/unfollow", users.UnfollowUser(db))
	userGroup.PATCH("/users", users.UpdateUser(db))

	// Room routes
	userGroup.GET("/rooms", rooms.GetRooms(db))
	userGroup.POST("/rooms", rooms.CreateRoom(db))
	userGroup.POST("/rooms/reserve", rooms.ReserveRoom(db))
	userGroup.POST("/rooms/participant", rooms.AddParticipant(db))
	userGroup.POST("/rooms/disconnect", rooms.HandleDisconnect)

	// WebRTC routes
	r.POST("/api/webrtc", middleware.AuthMiddleware(bJwtToken), rooms.HandleWebRTC(db))
	r.POST("/api/ice", middleware.AuthMiddleware(bJwtToken), rooms.HandleICECandidate)

	r.NoRoute(routeNotFound)
}
