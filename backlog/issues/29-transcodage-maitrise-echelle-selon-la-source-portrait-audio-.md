# Transcodage maîtrisé : échelle selon la source, portrait, audio encodé une fois, plafond de lives

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H4, H5, H14

## Problème
4 encodages x264 par live (le 1080p est toujours produit, même pour une source 480p/720p), AAC encodé 4 fois, aucun plafond de lives simultanés ni limite CPU, dans le même conteneur que l'API et le SFU. Les vidéos portrait (téléphone) sont letterboxées en 16:9 (`pad=1920:1080`) dans toutes les renditions et le replay.

## Correctif proposé
Choisir l'échelle selon la résolution source, supprimer le pad (`scale=-2:720`), audio encodé une fois, sémaphore de lives HLS avec mode dégradé, limites de ressources compose, envisager un worker FFmpeg séparé.

## Critères d'acceptation
- [ ] Un live portrait 720p reste portrait dans toutes les renditions
- [ ] Un 4ᵉ live simultané ne dégrade pas le SFU (test de charge)

## Fichiers concernés
- `backend/internal/hls/streamer.go`
- `docker-compose.yml`
