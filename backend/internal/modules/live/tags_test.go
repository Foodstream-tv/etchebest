package live

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNormalizeTagNames(t *testing.T) {
	got, ok := normalizeTagNames([]string{" Italien ", "", "italien", "Street food", "street-food", "Vegan"})
	if !ok {
		t.Fatal("a normal list must be accepted")
	}
	want := []string{"Italien", "Street food", "Vegan"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestNormalizeTagNamesRefusesTooMany(t *testing.T) {
	var names []string
	for i := 0; i <= maxLiveTags; i++ {
		names = append(names, string(rune('a'+i)))
	}
	if _, ok := normalizeTagNames(names); ok {
		t.Errorf("more than %d tags must be refused", maxLiveTags)
	}
}

func TestNormalizeTagNamesRefusesLongName(t *testing.T) {
	if _, ok := normalizeTagNames([]string{string(bytes.Repeat([]byte("a"), maxTagNameLength+1))}); ok {
		t.Error("a name over the column size must be refused")
	}
}

func patchTags(r *gin.Engine, url, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, url, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

// Needs Postgres (TEST_DATABASE_DSN), like the replay removal tests.
func TestOnlyTheHostCanEditTags(t *testing.T) {
	db := testDB(t)
	live := Live{RoomID: "room-tags", Title: "Tarte", UserID: "host", Status: "scheduled"}
	if err := db.Create(&live).Error; err != nil {
		t.Fatal(err)
	}

	build := func(userID string) *gin.Engine {
		gin.SetMode(gin.TestMode)
		r := gin.New()
		r.Use(func(c *gin.Context) {
			if userID != "" {
				c.Set("userId", userID)
			}
		})
		r.PATCH("/lives/:id/tags", UpdateLiveTags(db))
		return r
	}

	if w := patchTags(build(""), "/lives/room-tags/tags", `{"tags":["Italien"]}`); w.Code != http.StatusUnauthorized {
		t.Errorf("anonymous: status %d", w.Code)
	}
	if w := patchTags(build("someone"), "/lives/room-tags/tags", `{"tags":["Italien"]}`); w.Code != http.StatusForbidden {
		t.Errorf("not the host: status %d", w.Code)
	}

	w := patchTags(build("host"), "/lives/room-tags/tags", `{"tags":["Italien","Vegan"]}`)
	if w.Code != http.StatusOK {
		t.Fatalf("host: status %d (%s)", w.Code, w.Body.String())
	}
	var got Live
	db.Preload("Tags").First(&got, live.ID)
	if len(got.Tags) != 2 || got.DishName != "Italien" {
		t.Errorf("tags not saved: %+v", got)
	}

	// Replacing with an empty list clears them.
	if w := patchTags(build("host"), "/lives/room-tags/tags", `{"tags":[]}`); w.Code != http.StatusOK {
		t.Fatalf("clear: status %d", w.Code)
	}
	db.Preload("Tags").First(&got, live.ID)
	if len(got.Tags) != 0 || got.DishName != "" {
		t.Errorf("tags must be cleared: %+v", got)
	}

	db.Model(&got).Update("status", "ended")
	if w := patchTags(build("host"), "/lives/room-tags/tags", `{"tags":["Vegan"]}`); w.Code != http.StatusConflict {
		t.Errorf("ended live: status %d", w.Code)
	}
}
