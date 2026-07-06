package upload

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UploadImage handles image file uploads
func UploadImage() gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Aucun fichier reçu"})
			return
		}

		// Enforce size limit of 5MB (matching the frontend check)
		if file.Size > 5*1024*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "L'image ne doit pas dépasser 5 Mo"})
			return
		}

		// Basic content type validation
		contentType := file.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, "image/") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Le fichier sélectionné doit être une image"})
			return
		}

		// Create upload directory if it does not exist
		uploadDir := "./storage/uploads"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de créer le dossier de stockage"})
			return
		}

		// Generate secure filename using UUID to prevent collisions/directory traversal
		id := uuid.New().String()
		ext := strings.ToLower(filepath.Ext(file.Filename))
		if ext == "" {
			ext = ".jpg" // fallback extension
		}

		// Basic sanity check on extension to avoid arbitrary files
		validExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
		if !validExts[ext] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format d'image non supporté (JPG, PNG, GIF, WEBP uniquement)"})
			return
		}

		filename := id + ext
		targetPath := filepath.Join(uploadDir, filename)

		if err := c.SaveUploadedFile(file, targetPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Échec de la sauvegarde de l'image"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"url": "/api/uploads/" + filename,
		})
	}
}
