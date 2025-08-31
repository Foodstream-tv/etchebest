package routes

import (
	"foodstream/middleware"
	"foodstream/rooms"
	"foodstream/webrtc"
	"net/http"

	"github.com/gin-gonic/gin"
)

func routeNotFound(c *gin.Context) {
	c.JSON(http.StatusNotFound, gin.H{
		"message": "The endpoint that you are trying to reach doesn't exist",
	})
}

func Handler(r *gin.Engine) {
	r.Use(middleware.CorsHandler())
	r.POST("/createRoom", rooms.CreateRoom)
	r.GET("/rooms", rooms.GetRooms)
	r.POST("/webrtc", webrtc.HandleWebRTC)
	r.POST("/ice", webrtc.HandleICECandidate)
	r.POST("/disconnect", webrtc.HandleDisconnect)
	// r.GET("/ws", signaling.HandleWebSocket)
	r.NoRoute(routeNotFound)
}
