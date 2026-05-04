package room

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
	"gorm.io/gorm"
)

// WSMessage represents messages sent over WebSocket
type WSMessage struct {
	Type    string                     `json:"type"`
	Offer   *webrtc.SessionDescription `json:"offer,omitempty"`
	Error   string                     `json:"error,omitempty"`
}

// WSClientConn stores WebSocket connection per user
type WSClientConn struct {
	conn     *websocket.Conn
	userID   string
	roomID   string
	sendChan chan WSMessage
	done     chan struct{}
}

// wsConnections maps roomId -> userId -> *WSClientConn
var (
	wsConnMu     sync.RWMutex
	wsConnections = make(map[string]map[string]*WSClientConn)
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now, can be restricted later
	},
}

// HandleWebSocketOffer handles WebSocket connections for renegotiation offers
// @Summary	Establish WebSocket connection for receiving renegotiation offers
// @Tags		WebRTC
// @Param		roomId	query	string	true	"Room ID"
// @Success	101	"Switching Protocols"
// @Failure	400	{object}	map[string]string	"Invalid request"
// @Failure	401	{object}	map[string]string	"Unauthorized"
// @Failure	404	{object}	map[string]string	"Room not found"
// @Router		/webrtc/offers [get]
func HandleWebSocketOffer(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		roomID := c.Query("roomId")
		if roomID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "roomId required"})
			return
		}

		userID := c.GetString("userId")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}

		// Verify room exists and user is connected to it
		room, err := getLiveRoom(db, roomID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}

		// Verify user is in this room
		if !isUserInRoom(room, userID) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not in room"})
			return
		}

		// Upgrade HTTP connection to WebSocket
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		wsClient := &WSClientConn{
			conn:     conn,
			userID:   userID,
			roomID:   roomID,
			sendChan: make(chan WSMessage, 10),
			done:     make(chan struct{}),
		}

		// Register connection
		registerWSConnection(wsClient)

		// Handle the connection
		go handleWSConnection(wsClient)

		log.Printf("[WS] User %s connected to room %s", userID, roomID)
	}
}

// registerWSConnection stores the WebSocket connection
func registerWSConnection(wsClient *WSClientConn) {
	wsConnMu.Lock()
	defer wsConnMu.Unlock()

	if wsConnections[wsClient.roomID] == nil {
		wsConnections[wsClient.roomID] = make(map[string]*WSClientConn)
	}

	// Close old connection if exists
	if old, exists := wsConnections[wsClient.roomID][wsClient.userID]; exists {
		old.close()
	}

	wsConnections[wsClient.roomID][wsClient.userID] = wsClient
}

// unregisterWSConnection removes the WebSocket connection
func unregisterWSConnection(wsClient *WSClientConn) {
	wsConnMu.Lock()
	defer wsConnMu.Unlock()

	if roomConns, exists := wsConnections[wsClient.roomID]; exists {
		if _, userExists := roomConns[wsClient.userID]; userExists {
			delete(roomConns, wsClient.userID)
			if len(roomConns) == 0 {
				delete(wsConnections, wsClient.roomID)
			}
		}
	}
}

// handleWSConnection reads and writes to the WebSocket
func handleWSConnection(wsClient *WSClientConn) {
	defer func() {
		unregisterWSConnection(wsClient)
		wsClient.close()
		log.Printf("[WS] User %s disconnected from room %s", wsClient.userID, wsClient.roomID)
	}()

	// Start message sender goroutine
	go func() {
		for {
			select {
			case msg := <-wsClient.sendChan:
				if err := wsClient.conn.WriteJSON(msg); err != nil {
					log.Printf("[WS] write error: %v", err)
					return
				}
			case <-wsClient.done:
				return
			}
		}
	}()

	// Read messages from client (currently just for keepalive/pings)
	for {
		_, data, err := wsClient.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] read error: %v", err)
			}
			return
		}

		// Handle any incoming messages if needed
		var msg WSMessage
		if err := json.Unmarshal(data, &msg); err == nil {
			// Currently just acknowledge, can be extended later
			log.Printf("[WS] received message type: %s", msg.Type)
		}
	}
}

// sendOfferToUser sends a renegotiation offer to a user via WebSocket
func sendOfferToUser(roomID, userID string, offer *webrtc.SessionDescription) bool {
	wsConnMu.RLock()
	wsClient, exists := wsConnections[roomID][userID]
	wsConnMu.RUnlock()

	if !exists {
		log.Printf("[WS] no active connection for user %s in room %s", userID, roomID)
		return false
	}

	msg := WSMessage{
		Type:  "offer",
		Offer: offer,
	}

	select {
	case wsClient.sendChan <- msg:
		log.Printf("[WS] sent offer to user %s in room %s", userID, roomID)
		return true
	case <-wsClient.done:
		log.Printf("[WS] connection closed for user %s in room %s", userID, roomID)
		return false
	default:
		log.Printf("[WS] send channel full for user %s in room %s", userID, roomID)
		return false
	}
}

// close closes the WebSocket connection
func (wsc *WSClientConn) close() {
	select {
	case <-wsc.done:
		return
	default:
		close(wsc.done)
	}
	wsc.conn.Close()
}

// isUserInRoom checks if a user is connected to a room
func isUserInRoom(room *Room, userID string) bool {
	if room == nil {
		return false
	}
	for _, conn := range room.Connections {
		if conn.UserID == userID {
			return true
		}
	}
	return false
}
