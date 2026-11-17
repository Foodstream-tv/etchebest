package chat

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/Foodstream-io/etchebest/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func chatRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", "user-1") })
	r.POST("/rooms/:roomId/chat", CreateNewChat(db))
	return r
}

func postChat(r *gin.Engine, roomID, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/rooms/"+roomID+"/chat", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// A nil database: a refused message must be answered before anything touches the database.
func TestAMalformedMessageIsRefusedBeforeTheDatabase(t *testing.T) {
	r := chatRouter(nil)
	cases := map[string]string{
		"empty object":    `{}`,
		"null message":    `{"message":null}`,
		"empty message":   `{"message":""}`,
		"blank message":   `{"message":"   \n\t "}`,
		"not json":        `message`,
		"wrong type":      `{"message":42}`,
		"too long":        `{"message":"` + strings.Repeat("a", MaxMessageLength+1) + `"}`,
		"too long, utf-8": `{"message":"` + strings.Repeat("é", MaxMessageLength+1) + `"}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if w := postChat(r, "room-1", body); w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (%s)", w.Code, w.Body.String())
			}
		})
	}
}

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("TEST_DATABASE_DSN not set: skipping the Postgres integration test")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := admin.Exec("CREATE SCHEMA IF NOT EXISTS chat_test").Error; err != nil {
		t.Fatal(err)
	}
	db, err := gorm.Open(postgres.Open(dsn+" search_path=chat_test"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for _, stmt := range []string{
		"DROP TABLE IF EXISTS chats", "DROP TABLE IF EXISTS lives",
		"CREATE TABLE lives (id serial PRIMARY KEY, room_id text)",
	} {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := db.AutoMigrate(&Chat{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestAMessageIsStoredOnlyInARoomThatExists(t *testing.T) {
	db := testDB(t)
	if err := db.Exec("INSERT INTO lives (room_id) VALUES ('room-1')").Error; err != nil {
		t.Fatal(err)
	}
	r := chatRouter(db)

	if w := postChat(r, "room-1", `{"message":"bonjour"}`); w.Code != http.StatusOK {
		t.Fatalf("a message in an existing room: %d %s", w.Code, w.Body.String())
	}
	if w := postChat(r, "invented-room", `{"message":"bonjour"}`); w.Code != http.StatusNotFound {
		t.Fatalf("a message in a room nobody created: %d, want 404", w.Code)
	}
	var stored int64
	db.Model(&Chat{}).Count(&stored)
	if stored != 1 {
		t.Fatalf("%d messages stored, want exactly the one of the existing room", stored)
	}
}

func TestADatabaseErrorIsNeverSentToTheClient(t *testing.T) {
	db := testDB(t)
	if err := db.Exec("INSERT INTO lives (room_id) VALUES ('room-1')").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("DROP TABLE chats").Error; err != nil { // makes the insert fail
		t.Fatal(err)
	}
	w := postChat(chatRouter(db), "room-1", `{"message":"hello"}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	for _, leak := range []string{"chats", "relation", "SQLSTATE", "pq", "pgconn"} {
		if strings.Contains(w.Body.String(), leak) {
			t.Fatalf("the response leaks %q: %s", leak, w.Body.String())
		}
	}
}

// A struct tag cannot use the constant: this keeps the three copies of the limit in step.
func TestTheMessageLimitIsTheSameInTheConstantTheBindingAndTheColumn(t *testing.T) {
	post, _ := reflect.TypeOf(PostChat{}).FieldByName("Message")
	if want := fmt.Sprintf("max=%d", MaxMessageLength); !strings.Contains(post.Tag.Get("binding"), want) {
		t.Fatalf("PostChat binding tag %q lacks %q", post.Tag.Get("binding"), want)
	}
	col, _ := reflect.TypeOf(Chat{}).FieldByName("Message")
	if want := fmt.Sprintf("varchar(%d)", MaxMessageLength); !strings.Contains(col.Tag.Get("gorm"), want) {
		t.Fatalf("Chat gorm tag %q lacks %q", col.Tag.Get("gorm"), want)
	}
}

func TestAnOversizeMessageBodyIsAnsweredWith413(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("userId", "user-1") })
	r.POST("/rooms/:roomId/chat", middleware.LimitBody(1<<10), CreateNewChat(nil))
	big := `{"message":"` + strings.Repeat("a", 1<<20) + `"}`
	for name, announce := range map[string]int64{"announced": int64(len(big)), "chunked": -1} {
		req := httptest.NewRequest(http.MethodPost, "/rooms/r/chat", strings.NewReader(big))
		req.ContentLength = announce
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("%s: status %d, want 413", name, w.Code)
		}
	}
}

func TestTheStoredMessageIsTrimmed(t *testing.T) {
	db := testDB(t)
	if err := db.Exec("INSERT INTO lives (room_id) VALUES ('room-1')").Error; err != nil {
		t.Fatal(err)
	}
	if w := postChat(chatRouter(db), "room-1", `{"message":"\n\n  bonjour  \n"}`); w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var c Chat
	if err := db.First(&c).Error; err != nil || c.Message != "bonjour" {
		t.Fatalf("stored %q, %v", c.Message, err)
	}
}
