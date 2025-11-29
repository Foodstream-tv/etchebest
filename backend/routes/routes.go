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

func SetupRoutes(r *gin.Engine, db *gorm.DB, jwtToken string) {
	r.Use(middleware.CorsHandler())

	// Auth routes
	r.POST("/register", registerHandler(db))
	r.POST("/login", loginHandler(db, []byte(jwtToken)))

	// Room routes
	r.POST("/createRoom", middleware.AuthMiddleware([]byte(jwtToken)), createRoomHandler(db))
	r.GET("/rooms", getRoomsHandler(db))
	r.POST("/reserve", middleware.AuthMiddleware([]byte(jwtToken)), reserveRoomHandler)
	r.POST("/addParticipant", middleware.AuthMiddleware([]byte(jwtToken)), addParticipantHandler)

	// WebRTC routes
	r.POST("/webrtc", webrtcHandler)
	r.POST("/ice", iceHandler)
	r.POST("/disconnect", disconnectHandler)

	r.NoRoute(routeNotFound)
}

// registerHandler godoc
// @Summary      Register a new user
// @Description  Create a new user account with email and password
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.RegisterRequest true "Registration details"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /register [post]
func registerHandler(db *gorm.DB) gin.HandlerFunc {
	return auth.Register(db)
}

// loginHandler godoc
// @Summary      Login user
// @Description  Authenticate user and return JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body auth.LoginRequest true "Login credentials"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /login [post]
func loginHandler(db *gorm.DB, jwtKey []byte) gin.HandlerFunc {
	return auth.Login(db, jwtKey)
}

// createRoomHandler godoc
// @Summary      Create or join a room
// @Description  Create a new streaming room or join existing one by name
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body rooms.RoomRequest true "Room details"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /createRoom [post]
func createRoomHandler(db *gorm.DB) gin.HandlerFunc {
	return rooms.CreateRoom(db)
}

// getRoomsHandler godoc
// @Summary      Get all rooms
// @Description  Retrieve list of all streaming rooms
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string][]models.Room
// @Failure      500  {object}  map[string]string
// @Router       /rooms [get]
func getRoomsHandler(db *gorm.DB) gin.HandlerFunc {
	return rooms.GetRooms(db)
}

// reserveRoomHandler godoc
// @Summary      Reserve a spot in a room
// @Description  Reserve a participant slot in a room in advance
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body object{roomId=string} true "Room ID to reserve"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      403  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /reserve [post]
func reserveRoomHandler(c *gin.Context) {
	rooms.ReserveRoom(c)
}

// addParticipantHandler godoc
// @Summary      Add participant to room
// @Description  Add a user as a participant to a specific room
// @Tags         rooms
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body rooms.AddParticipantReq true "Room and user IDs"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Router       /addParticipant [post]
func addParticipantHandler(c *gin.Context) {
	rooms.AddParticipant(c)
}

// webrtcHandler godoc
// @Summary      Establish WebRTC connection
// @Description  Create WebRTC peer connection for video streaming (participants only)
// @Tags         webrtc
// @Accept       json
// @Produce      json
// @Param        roomId query string true "Room ID"
// @Param        offer body object true "WebRTC Session Description"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      403  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /webrtc [post]
func webrtcHandler(c *gin.Context) {
	webrtc.HandleWebRTC(c)
}

// iceHandler godoc
// @Summary      Handle ICE candidates
// @Description  Add ICE candidates for WebRTC connection establishment
// @Tags         webrtc
// @Accept       json
// @Produce      json
// @Param        roomId query string true "Room ID"
// @Param        candidate body object true "ICE Candidate"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /ice [post]
func iceHandler(c *gin.Context) {
	webrtc.HandleICECandidate(c)
}

// disconnectHandler godoc
// @Summary      Disconnect from room
// @Description  Close all WebRTC connections and clean up room resources
// @Tags         webrtc
// @Accept       json
// @Produce      json
// @Param        roomId query string true "Room ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Router       /disconnect [post]
func disconnectHandler(c *gin.Context) {
	webrtc.HandleDisconnect(c)
}
