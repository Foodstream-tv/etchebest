package signaling

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var clients = make(map[*websocket.Conn]bool)
var broadcast = make(chan []byte)
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func HandleWebSocket(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Erreur WebSocket: %v", err)
		return
	}
	defer ws.Close()

	clients[ws] = true
	log.Println("New client connected")
	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Println("Client disconnected")
			delete(clients, ws)
			break
		}
		broadcast <- msg
	}
	go func() {
		for {
			msg := <-broadcast
			for client := range clients {
				err := client.WriteMessage(websocket.TextMessage, msg)
				if err != nil {
					log.Println("Message error:", err)
					client.Close()
					delete(clients, client)
				}
			}
		}
	}()
}
