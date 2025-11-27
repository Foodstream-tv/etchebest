package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func init() {
	var err error
	DB, err = InitDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
}

func InitDB() (*gorm.DB, error) {
	// Only for development
	godotenv.Load("../.env")

	required := []string{
		"POSTGRES_HOST",
		"POSTGRES_USER",
		"POSTGRES_PASSWORD",
		"POSTGRES_DB",
		"POSTGRES_PORT",
	}

	env := make(map[string]string)

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

	for i := range 10 {
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

		log.Printf("Waiting for database... (%d/10): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}

	log.Println("Database connected")
	return db, nil
}
