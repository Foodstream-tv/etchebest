package config

import (
	"fmt"
	"github.com/joho/godotenv"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDB() (*gorm.DB, error) {
	// Only for development, no need to handle the error that Load function returns
	godotenv.Load("../.env")

	env := make(map[string]string)
	required := []string{
		"POSTGRES_HOST",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
		"POSTGRES_PORT",
	}

	for _, key := range required {
		val := os.Getenv(key)
		if val == "" {
			return nil, fmt.Errorf("environment variable %s is missing", key)
		}
		env[key] = val
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		env["POSTGRES_HOST"],
		env["POSTGRES_USER"],
		env["POSTGRES_PASSWORD"],
		env["POSTGRES_DB"],
		env["POSTGRES_PORT"],
	)

	var db *gorm.DB
	var err error

	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err == nil {
		sqlDB, pingErr := db.DB()
		if pingErr == nil {
			pingErr = sqlDB.Ping()
		}
		if pingErr == nil {
			log.Println("Database connected")
			return db, nil
		}
		err = pingErr
	}
	return db, nil
}
