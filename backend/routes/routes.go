package routes

import (
	"github.com/Foodstream-io/etchebest/auth"
	"github.com/Foodstream-io/etchebest/middleware"
	"github.com/Foodstream-io/etchebest/rooms"
	"github.com/Foodstream-io/etchebest/webrtc"
	"gorm.io/gorm"
	"net/http"

	"github.com/gin-gonic/gin"
)

func routeNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{
		"message": "The endpoint that you are trying to reach doesn't exist",
	})
}

func Handler(r *gin.Engine, db *gorm.DB, jwtToken string) {
	r.Use(middleware.CorsHandler())
	r.POST("/register", auth.Register(db))
	r.POST("/login", auth.Login(db, []byte(jwtToken)))
	r.POST("/createRoom", middleware.AuthMiddleware([]byte(jwtToken)), rooms.CreateRoom(db))
	r.GET("/rooms", rooms.GetRooms(db))
	r.POST("/webrtc", webrtc.HandleWebRTC)
	r.POST("/ice", webrtc.HandleICECandidate)
	r.POST("/disconnect", webrtc.HandleDisconnect)
	// r.GET("/ws", signaling.HandleWebSocket)
	r.NoRoute(routeNotFound)
}
