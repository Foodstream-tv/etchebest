package config

import (
	"context"
	"log"
	"os"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go"
	"firebase.google.com/go/auth"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
)

var AuthClient *auth.Client

var FirestoreClient *firestore.Client

func InitFirebase() {
	err := godotenv.Load("config/config.env")
	if err != nil {
		log.Fatalf("Error loading .env file")
	}
	opt := option.WithCredentialsFile(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"))
	app, err := firebase.NewApp(context.Background(), nil, opt)
	if err != nil {
		log.Fatalf("Firebase error: %v", err)
	}
	AuthClient, err = app.Auth(context.Background())
	if err != nil {
		log.Fatalf("Auth error: %v", err)
	}
	InitFirestore()
}

func InitFirestore() {
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "foodstream-4d655")
	if err != nil {
		log.Fatalf("Error Firestore: %v", err)
	}
	FirestoreClient = client
	log.Println("Firebase and Firestore are successfully connected")
}
