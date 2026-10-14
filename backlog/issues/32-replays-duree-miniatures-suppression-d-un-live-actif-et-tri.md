# Replays : durée, miniatures, suppression d'un live actif et tri

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H7, H17, H21

## Problème
La durée du replay n'est jamais mesurée (seulement la durée prévue), aucune miniature ni `preview_gif` n'est générée (les lives créés depuis le mobile n'ont pas de visuel), les lives plus courts que le premier segment n'ont pas de replay. `DELETE /lives/:id` pendant un live ne coupe ni FFmpeg ni la room et le replay est quand même copié vers un dossier orphelin. `GetLives` trie `COALESCE(scheduled_at, created_at) ASC` pour tous les statuts (replays du plus ancien au plus récent) sans tie-breaker (pagination qui duplique/saute).

## Correctif proposé
Mesurer la durée réelle, miniature et aperçu via FFmpeg, refuser `DELETE` sauf si `ended` (ou démonter d'abord), tri par statut avec `id` en tie-breaker.

## Critères d'acceptation
- [ ] Chaque replay a une durée et une miniature
- [ ] Supprimer un live actif est refusé ou arrête proprement tout
- [ ] Les replays sont listés du plus récent au plus ancien sans doublons

## Fichiers concernés
- `backend/internal/modules/live/handler.go`
- `backend/internal/hls/replay.go`
