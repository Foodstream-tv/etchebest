package main

import (
	"net/http"

	"github.com/Foodstream-io/etchebest/pages/discover"
	"github.com/Foodstream-io/etchebest/pages/home"
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
	admin.Use(middleware.RequireRole("ADMIN"))

	// Authentication
	r.POST("/api/register", auth.Register(db))
	r.POST("/api/login", auth.Login(db, bJwtToken))

	// User
	admin.GET("/users", users.GetUsers(db))
	api.GET("/users/me", users.GetMe(db))
	api.POST("/users/follow", users.FollowUser(db))
	api.POST("/users/unfollow", users.UnfollowUser(db))
	api.PATCH("/users", users.UpdateUser(db))

	// Rooms
	api.GET("/rooms", rooms.GetRooms(db))
	api.POST("/rooms", rooms.CreateRoom(db))
	api.POST("/rooms/reserve", rooms.ReserveRoom(db))
	api.POST("/rooms/participant", rooms.AddParticipant(db))
	api.POST("/rooms/disconnect", rooms.HandleDisconnect)

	// WebRTC
	api.POST("/webrtc", rooms.HandleWebRTC(db))
	api.POST("/ice", rooms.HandleICECandidate)

	// Discover
	api.GET("/discover", discover.GetDiscoverHome(db))
	api.GET("/discover/categories", discover.GetCategories(db))
	api.GET("/discover/categories/:id/lives", discover.GetCategoryLives(db))

	// Home
	api.GET("/home", home.GetHomePage(db))
	api.GET("/home/lives", home.GetLivesByTab(db))
	api.GET("/home/lives/filtered", home.GetLivesWithFilters(db))
	api.GET("/home/search", home.SearchLives(db))
	api.GET("/home/tags", home.GetTags(db))
	api.GET("/home/chefs", home.GetFeaturedChefs(db))

	// Not found
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"message": "the endpoint that you are trying to reach doesn't exist",
		})
	})
}
