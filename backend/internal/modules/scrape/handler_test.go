package scrape

import "testing"

func TestIsMarmitonURL(t *testing.T) {
	allowed := []string{
		"https://www.marmiton.org/recettes/recette_pates-carbonara_1234.aspx",
		"https://marmiton.org/recettes/x.aspx",
		"https://WWW.MARMITON.ORG/recettes/x",
		"https://www.marmiton.org:443/recettes/x",
	}
	for _, u := range allowed {
		if !isMarmitonURL(u) {
			t.Errorf("%q should be allowed", u)
		}
	}

	refused := []string{
		"",
		"http://www.marmiton.org/recettes/x", // not https
		"https://evil.test/?marmiton.org",    // the old strings.Contains check passed this
		"https://marmiton.org.evil.test/recettes",         // lookalike host
		"https://evilmarmiton.org/recettes",               // not a subdomain
		"https://marmiton.org@evil.test/",                 // credentials trick, host is evil.test
		"https://localhost:8081/api/admin?x=marmiton.org", // internal service
		"http://169.254.169.254/latest/meta-data/",
		"file:///etc/passwd",
		"//www.marmiton.org/recettes",
		"https://www.marmiton.org\\@evil.test/",
	}
	for _, u := range refused {
		if isMarmitonURL(u) {
			t.Errorf("%q must be refused", u)
		}
	}
}
