package main

import (
	"fmt"
	"foodstream/config"
	"foodstream/models"
	"foodstream/pkg"
	"foodstream/routes"

	"github.com/gin-gonic/gin"
)

func main() {
	config.InitDB()
	config.DB.AutoMigrate(&models.User{}, &models.Room{})

	r := gin.Default()
	r.SetTrustedProxies(nil)
	fmt.Println("Listening on port 8081")
	{
		routes.Handler(r)
	}
	pkg.CheckError(r.Run(":8081"))
}
