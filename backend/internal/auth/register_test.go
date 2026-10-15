package auth

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

func validRegister() RequestRegister {
	return RequestRegister{
		Email:        "jane@example.com",
		Password:     "Password123@",
		FirstName:    "Jane",
		LastName:     "Doe",
		Username:     "jane",
		AgeConfirmed: true,
	}
}

func TestRegisterRequestPhoneAndBioAreOptional(t *testing.T) {
	req := validRegister() // no phone, no description
	if err := binding.Validator.ValidateStruct(&req); err != nil {
		t.Fatalf("a registration without phone and bio must be valid: %v", err)
	}

	req.Description = "I like sushi"
	req.CountryNumberPhone = 33
	req.NumberPhone = "612345678"
	if err := binding.Validator.ValidateStruct(&req); err != nil {
		t.Fatalf("a registration with phone and bio must still be valid: %v", err)
	}
}

func TestRegisterRequestRequiresTheAgeConfirmation(t *testing.T) {
	req := validRegister()
	req.AgeConfirmed = false
	if err := binding.Validator.ValidateStruct(&req); err == nil {
		t.Fatal("a registration without the age confirmation must be refused")
	}
}

func TestRegisterRequestKeepsTheEssentials(t *testing.T) {
	for name, mutate := range map[string]func(*RequestRegister){
		"email":     func(r *RequestRegister) { r.Email = "" },
		"bad email": func(r *RequestRegister) { r.Email = "nope" },
		"password":  func(r *RequestRegister) { r.Password = "short" },
		"firstName": func(r *RequestRegister) { r.FirstName = "" },
		"lastName":  func(r *RequestRegister) { r.LastName = "" },
		"username":  func(r *RequestRegister) { r.Username = "" },
	} {
		req := validRegister()
		mutate(&req)
		if err := binding.Validator.ValidateStruct(&req); err == nil {
			t.Errorf("%s: should be refused", name)
		}
	}
}

func TestRegisterRequestBoundsTheBio(t *testing.T) {
	req := validRegister()
	req.Description = strings.Repeat("a", 501)
	if err := binding.Validator.ValidateStruct(&req); err == nil {
		t.Fatal("a bio over 500 characters must be refused")
	}
}

func TestPhoneAndCountryCodeGoTogether(t *testing.T) {
	cases := []struct {
		country int
		number  string
		bad     bool
	}{
		{0, "", false},
		{33, "612345678", false},
		{33, "", true},
		{0, "612345678", true},
		{0, "   ", false}, // whitespace only counts as no number
	}
	for _, c := range cases {
		req := validRegister()
		req.CountryNumberPhone, req.NumberPhone = c.country, c.number
		if got := req.phoneInconsistent(); got != c.bad {
			t.Errorf("country=%d number=%q: inconsistent=%v, want %v", c.country, c.number, got, c.bad)
		}
	}
}

func TestRegisterHandlerRejectsAnInconsistentPhoneBeforeTouchingTheDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/register", Register(nil)) // a nil db would panic if the handler got past validation

	body := `{"email":"jane@example.com","password":"Password123@","firstName":"Jane","lastName":"Doe","username":"jane","ageConfirmed":true,"numberPhone":"612345678"}`
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString(body)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400: %s", w.Code, w.Body.String())
	}

	noAge := strings.Replace(body, `"ageConfirmed":true,`, "", 1)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/register", bytes.NewBufferString(noAge)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("missing age confirmation: status %d, want 400", w.Code)
	}
}
