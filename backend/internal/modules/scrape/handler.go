package scrape

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

type RecipeScrapeResponse struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Ingredients  []string `json:"ingredients"`
	Steps        []string `json:"steps"`
	PrepTimeMins int      `json:"prep_time_mins"`
	CookTimeMins int      `json:"cook_time_mins"`
	RestTimeMins int      `json:"rest_time_mins"`
	Utensils     []string `json:"utensils"`
}

func parseISODuration(d string) int {
	var hours, minutes int
	if _, err := fmt.Sscanf(d, "PT%dH%dM", &hours, &minutes); err == nil {
		return hours*60 + minutes
	}
	if _, err := fmt.Sscanf(d, "PT%dM", &minutes); err == nil {
		return minutes
	}
	if _, err := fmt.Sscanf(d, "PT%dH", &hours); err == nil {
		return hours * 60
	}
	return 0
}

func extractInstructions(raw any) []string {
	var steps []string
	switch v := raw.(type) {
	case []any:
		for _, item := range v {
			switch m := item.(type) {
			case string:
				steps = append(steps, m)
			case map[string]any:
				if txt, ok := m["text"].(string); ok {
					steps = append(steps, txt)
				}
			}
		}
	case string:
		steps = append(steps, v)
	}
	return steps
}

func ScrapeMarmiton() gin.HandlerFunc {
	return func(c *gin.Context) {
		url := c.Query("url")
		if url == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "url parameter is required"})
			return
		}

		// Basic validation to ensure it's a Marmiton link
		if !strings.Contains(url, "marmiton.org") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "only marmiton.org URLs are supported"})
			return
		}

		// Perform GET request with browser headers to avoid 403 Forbidden
		client := &http.Client{}
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create request: %v", err)})
			return
		}

		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
		req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7")
		req.Header.Set("Cache-Control", "no-cache")
		req.Header.Set("Connection", "keep-alive")

		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to fetch URL: %v", err)})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Marmiton returned status: %d", resp.StatusCode)})
			return
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to read response: %v", err)})
			return
		}
		htmlContent := string(bodyBytes)

		// 1. Parse JSON-LD
		var recipeTitle, recipeDesc string
		var ingredients []string
		var steps []string
		var prepTime, cookTime, restTime int

		jsonLdRegex := regexp.MustCompile(`(?s)<script[^>]*type=["']application(?:/|&#x2F;|&#47;)ld(?:\+|&#x2B;|&#43;)json["'][^>]*>(.*?)</script>`)
		matches := jsonLdRegex.FindAllStringSubmatch(htmlContent, -1)

		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			rawJSON := strings.TrimSpace(match[1])

			// Try to parse array or single object
			var parsed any
			if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
				continue
			}

			// Traverse to find @type == "Recipe"
			recipeObj := findRecipeObject(parsed)
			if recipeObj != nil {
				// Title
				if name, ok := recipeObj["name"].(string); ok {
					recipeTitle = name
				}
				// Description
				if desc, ok := recipeObj["description"].(string); ok {
					recipeDesc = desc
				}
				// Ingredients
				if ings, ok := recipeObj["recipeIngredient"].([]any); ok {
					for _, ing := range ings {
						if ingStr, ok := ing.(string); ok {
							ingredients = append(ingredients, ingStr)
						}
					}
				}
				// Steps
				if insts, ok := recipeObj["recipeInstructions"]; ok {
					steps = extractInstructions(insts)
				}
				// Times
				if pt, ok := recipeObj["prepTime"].(string); ok {
					prepTime = parseISODuration(pt)
				}
				if ct, ok := recipeObj["cookTime"].(string); ok {
					cookTime = parseISODuration(ct)
				}
				break
			}
		}

		// 2. Parse Utensils using Marmiton classes
		var utensils []string
		utensilsMap := make(map[string]bool)

		utensilsRegex := regexp.MustCompile(`class="recipe-utensil__name"[^>]*>([^<]+)`)
		utMatches := utensilsRegex.FindAllStringSubmatch(htmlContent, -1)
		for _, utMatch := range utMatches {
			if len(utMatch) >= 2 {
				uName := strings.TrimSpace(utMatch[1])
				if uName != "" && !utensilsMap[strings.ToLower(uName)] {
					utensilsMap[strings.ToLower(uName)] = true
					utensils = append(utensils, uName)
				}
			}
		}

		// Fallback utensils search if none found
		if len(utensils) == 0 {
			commonUtensils := []string{
				"Fouet", "Saladier", "Moule", "Poêle", "Casserole", "Balance",
				"Spatule", "Poche à douille", "Rouleau à pâtisserie", "Tamis", "Mixer",
				"Blender", "Éplucheur", "Planche à découper", "Couteau", "Râpe",
				"Passoire", "Maryse", "Pinceau", "Économe", "Cul de poule", "Louche",
			}
			htmlLower := strings.ToLower(htmlContent)
			for _, ut := range commonUtensils {
				if strings.Contains(htmlLower, strings.ToLower(ut)) {
					if !utensilsMap[strings.ToLower(ut)] {
						utensilsMap[strings.ToLower(ut)] = true
						utensils = append(utensils, ut)
					}
				}
			}
		}

		// Fallback title / description from og:tags if JSON-LD parsing failed
		if recipeTitle == "" {
			titleRegex := regexp.MustCompile(`(?i)<title>([^<]+)</title>`)
			if tMatch := titleRegex.FindStringSubmatch(htmlContent); len(tMatch) >= 2 {
				recipeTitle = strings.TrimSpace(tMatch[1])
				// Clean title suffix
				recipeTitle = strings.Split(recipeTitle, " - ")[0]
				recipeTitle = strings.Split(recipeTitle, " : ")[0]
			}
		}

		// Fallback steps extraction from HTML list items if JSON-LD had none
		if len(steps) == 0 {
			stepRegex := regexp.MustCompile(`(?s)<div[^>]*class="recipe-step-list__container"[^>]*>(.*?)</div>`)
			if stepListMatch := stepRegex.FindString(htmlContent); stepListMatch != "" {
				singleStepRegex := regexp.MustCompile(`(?s)<p[^>]*class="recipe-step-list__container__step__text"[^>]*>(.*?)</p>`)
				singleMatches := singleStepRegex.FindAllStringSubmatch(stepListMatch, -1)
				for _, sm := range singleMatches {
					if len(sm) >= 2 {
						steps = append(steps, strings.TrimSpace(sm[1]))
					}
				}
			}
		}

		// Fallback rest time search in text
		restTimeRegex := regexp.MustCompile(`(?i)temps de repos\s*:\s*(\d+)\s*min`)
		if rMatches := restTimeRegex.FindStringSubmatch(htmlContent); len(rMatches) >= 2 {
			var rMins int
			if _, err := fmt.Sscanf(rMatches[1], "%d", &rMins); err == nil {
				restTime = rMins
			}
		}

		c.JSON(http.StatusOK, RecipeScrapeResponse{
			Title:        recipeTitle,
			Description:  recipeDesc,
			Ingredients:  ingredients,
			Steps:        steps,
			PrepTimeMins: prepTime,
			CookTimeMins: cookTime,
			RestTimeMins: restTime,
			Utensils:     utensils,
		})
	}
}

func findRecipeObject(raw any) map[string]any {
	switch v := raw.(type) {
	case map[string]any:
		if t, ok := v["@type"].(string); ok && t == "Recipe" {
			return v
		}
		// Search inside keys
		for _, val := range v {
			if res := findRecipeObject(val); res != nil {
				return res
			}
		}
	case []any:
		for _, val := range v {
			if res := findRecipeObject(val); res != nil {
				return res
			}
		}
	}
	return nil
}
