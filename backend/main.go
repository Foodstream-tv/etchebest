package main

import (
	"fmt"
	"log"
	"os"

	"github.com/Foodstream-io/etchebest/config"
	_ "github.com/Foodstream-io/etchebest/docs"
	"github.com/Foodstream-io/etchebest/models"
	"github.com/gin-gonic/gin"
)

/*
@title           Etchebest API
@version         1.0
@description     API for Etchebest video streaming platform
@termsOfService  http://swagger.io/terms/

@contact.name   API Support
@contact.url    http://www.swagger.io/support
@contact.email  support@swagger.io

@license.name  Apache 2.0
@license.url   http://www.apache.org/licenses/LICENSE-2.0.html

@host      localhost:8080
@BasePath  /

@securityDefinitions.apikey BearerAuth
@in header
@name Authorization
@description Type "Bearer" followed by a space and JWT token.
*/
func main() {
	db, err := config.InitDB()
	if err != nil {
		log.Fatal(err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.Room{}); err != nil {
		log.Fatal(err)
	}

	r := gin.Default()
	if err := r.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}

	port := os.Getenv("BACKEND_PORT")
	if port == "" {
		log.Fatal("BACKEND_PORT is not set in the environment")
	}

	fmt.Printf("Listening on port %s\n", port)
	jwtKey := os.Getenv("JWT_SECRET")
	if jwtKey == "" {
		log.Fatal("JWT_SECRET is not set in the environment")
	}

	if err := db.AutoMigrate(&models.User{}, &models.Room{}); err != nil {
		log.Fatal(err)
	}

	routes(r, db, jwtKey)

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
