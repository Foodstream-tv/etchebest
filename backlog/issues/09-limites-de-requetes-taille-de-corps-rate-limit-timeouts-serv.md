# Limites de requêtes : taille de corps, rate limit, timeouts serveur, uploads

> Source : `AUDIT_LIVE_WEBRTC.md` — constats A3, A4, H20

## Problème
Aucun `MaxBytesReader`, aucun rate limit, `http.Server` sans timeouts (slowloris). ICE en attente sans plafond ni TTL ni contrôle d'appartenance (`/ice`, `/webrtc/offers/next` avec n'importe quel `roomId`). Upload : type MIME fait confiance au client, pas de limite de corps avant parsing, pas de quota.

## Correctif proposé
Middleware `MaxBytes`, limiteur IP/utilisateur (login, reserve, ice, answer, poll), `http.Server` avec `ReadHeaderTimeout/ReadTimeout/IdleTimeout`, plafonner l'ICE en attente (~50) et exiger d'être participant, uploads : `DetectContentType`, taille max, quota.

## Critères d'acceptation
- [ ] Un corps trop gros est rejeté en 413
- [ ] Un client qui dépasse le débit autorisé reçoit 429
- [ ] Test sur les endpoints de signalisation

## Fichiers concernés
- `backend/cmd/server/main.go`
- `backend/internal/modules/upload`
- `backend/internal/modules/room/room.go`
