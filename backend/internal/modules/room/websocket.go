package room

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
	"gorm.io/gorm"
)

// WSMessage represents messages sent over WebSocket
type WSMessage struct {
	Type  string                     `json:"type"`
	Offer *webrtc.SessionDescription `json:"offer,omitempty"`
	Error string                     `json:"error,omitempty"`
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
	wsConnMu      sync.RWMutex
	wsConnections = make(map[string]map[string]*WSClientConn)
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // Non-browser clients (mobile native, CLI, etc.)
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		hostname := u.Hostname()
		// Allow localhost / local development
		if hostname == "localhost" || hostname == "127.0.0.1" {
			return true
		}
		// Allow same host as request
		reqHost := r.Host
		if colon := strings.Index(reqHost, ":"); colon != -1 {
			reqHost = reqHost[:colon]
		}
		if strings.EqualFold(hostname, reqHost) {
			return true
		}
		// Allow explicitly configured origins
		if allowed := os.Getenv("CORS_ALLOWED_ORIGINS"); allowed != "" {
			for _, o := range strings.Split(allowed, ",") {
				o = strings.TrimSpace(o)
				if o == "*" || o == origin || o == hostname {
					return true
				}
			}
		}
		// Allow foodstream domains
		if hostname == "foodstream.tv" || strings.HasSuffix(hostname, ".foodstream.tv") {
			return true
		}
		log.Printf("[WS] CheckOrigin rejected origin: %s", origin)
		return false
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
			log.Printf("[WS] roomId missing from query params")
			c.JSON(http.StatusBadRequest, gin.H{"error": "roomId required"})
			return
		}
		log.Printf("[WS] WebSocket connection attempt for room %s", roomID)

		userID := c.GetString("userId")
		if userID == "" {
			log.Printf("[WS] userID not found in context (auth failed?)")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		log.Printf("[WS] authenticated as user %s", userID)

		// Verify room exists and user is connected to it
		// Room contents are shared with the signaling handlers: read them under mu.
		mu.Lock()
		room, err := getLiveRoom(db, roomID)
		if err != nil {
			mu.Unlock()
			log.Printf("[WS] room %s not found: %v", roomID, err)
			c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
			return
		}
		connectionCount := len(room.Connections)
		inRoom := isUserInRoom(room, userID)
		mu.Unlock()
		log.Printf("[WS] room %s found, has %d connections", roomID, connectionCount)

		// Verify user is in this room
		if !inRoom {
			log.Printf("[WS] user %s NOT in room %s", userID, roomID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not in room"})
			return
		}
		log.Printf("[WS] user %s verified in room %s", userID, roomID)

		// Upgrade HTTP connection to WebSocket
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("[WS] upgrade failed: %v", err)
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

const (
	wsMaxMessageSize = 4096
	wsPongWait       = 60 * time.Second
	wsPingPeriod     = 25 * time.Second
	wsWriteWait      = 10 * time.Second
)

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
		// Only remove the registration if it is still *this* connection: when a client reconnects,
		// registerWSConnection replaces (and closes) the old one, whose deferred cleanup would
		// otherwise delete the new registration and silence offers/kick messages for that user.
		if current, userExists := roomConns[wsClient.userID]; userExists && current == wsClient {
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

	// A half-open socket (phone that lost its network) must not keep a goroutine, a map entry and
	// an offer queue alive forever: bound message size, require pongs, bound writes.
	wsClient.conn.SetReadLimit(wsMaxMessageSize)
	_ = wsClient.conn.SetReadDeadline(time.Now().Add(wsPongWait))
	wsClient.conn.SetPongHandler(func(string) error {
		return wsClient.conn.SetReadDeadline(time.Now().Add(wsPongWait))
	})

	// Start message sender goroutine
	go func() {
		ping := time.NewTicker(wsPingPeriod)
		defer ping.Stop()
		for {
			select {
			case msg := <-wsClient.sendChan:
				_ = wsClient.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
				if err := wsClient.conn.WriteJSON(msg); err != nil {
					log.Printf("[WS] write error: %v", err)
					// Unblock the reader and mark the connection dead so offers are not
					// reported as "delivered" to a writer that no longer exists.
					wsClient.close()
					return
				}
			case <-ping.C:
				_ = wsClient.conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
				if err := wsClient.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					wsClient.close()
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

// NotifyUserKicked sends a kicked message over WebSocket to a specific user
func NotifyUserKicked(roomID, userID string) bool {
	wsConnMu.RLock()
	defer wsConnMu.RUnlock()

	roomConns, exists := wsConnections[roomID]
	if !exists {
		return false
	}

	wsClient, exists := roomConns[userID]
	if !exists {
		return false
	}

	msg := WSMessage{
		Type: "kicked",
	}

	select {
	case wsClient.sendChan <- msg:
		log.Printf("[WS] sent kicked notification to user %s in room %s", userID, roomID)
		return true
	case <-wsClient.done:
		return false
	default:
		log.Printf("[WS] send channel full for user %s in room %s", userID, roomID)
		return false
	}
}
