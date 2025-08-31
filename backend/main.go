package main

import (
	"fmt"
	"foodstream/config"
	"foodstream/pkg"
	"foodstream/routes"

	"github.com/gin-gonic/gin"
)

func main() {
	config.InitFirebase()

	r := gin.Default()
	r.SetTrustedProxies(nil)
	// r.Use(middleware.AuthMiddleware())
	r.GET("/protected", func(c *gin.Context) {
		// userId, _ := c.Get("userId")
		// c.JSON(200, gin.H{"message": "Authorized", "userId": userId})
		c.JSON(200, gin.H{"message": "Authorized without auth"})
	})
	fmt.Println("Listening on port 8081")
	{
		routes.Handler(r)
	}
	pkg.CheckError(r.Run(":8081"))
}
