package routes

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/auth"
	"github.com/Foodstream-io/etchebest/middleware"
	"github.com/Foodstream-io/etchebest/rooms"
	"github.com/Foodstream-io/etchebest/webrtc"
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

	// Auth routes
	r.POST("/register", auth.Register(db))
	r.POST("/login", auth.Login(db, []byte(jwtToken)))

	// Room routes
	r.GET("/rooms", middleware.AuthMiddleware([]byte(jwtToken)), rooms.GetRooms(db))
	r.POST("/rooms", middleware.AuthMiddleware([]byte(jwtToken)), rooms.CreateRoom(db))
	r.POST("/rooms/reserve", middleware.AuthMiddleware([]byte(jwtToken)), rooms.ReserveRoom(db))
	r.POST("/rooms/participant", middleware.AuthMiddleware([]byte(jwtToken)), rooms.AddParticipant(db))

	// WebRTC routes
	r.POST("/webrtc", middleware.AuthMiddleware([]byte(jwtToken)), webrtc.HandleWebRTC(db))
	r.POST("/ice", middleware.AuthMiddleware([]byte(jwtToken)), webrtc.HandleICECandidate)
	r.POST("/disconnect", middleware.AuthMiddleware([]byte(jwtToken)), webrtc.HandleDisconnect)

	r.NoRoute(routeNotFound)
}
