# Tests backend : concurrence, handlers de rooms, HLS, live et upload

> Source : `AUDIT_LIVE_WEBRTC.md` — constats Tests

## Problème
`room_test.go` ne contient que quelques tests triviaux ; rien sur les handlers, la machine d'états du live, la concurrence (`-race`), les 409, la reconnexion, la grâce de déconnexion, le kick, ICE/answer, le WebSocket, les parseurs STAP-A/FU-A/VP8 (à fuzzer), le middleware d'auth. Les paquets `modules/live`, `discover` et `upload` n'ont aucun test, `internal/hls` n'en a que pour le replay.

## Correctif proposé
Tests avec `-race` (join/reserve/cancel/kick concurrents), table tests des handlers, faux binaire FFmpeg (démarrage/crash/arrêt), replay depuis un dossier fixture, test d'intégration à deux clients Pion, test de réconciliation au démarrage, fuzz des parseurs RTP.

## Critères d'acceptation
- [ ] `go test -race ./...` passe en CI
- [ ] Couverture des machines d'états de room et de live

## Fichiers concernés
- `backend/internal/modules/room`
- `backend/internal/hls`
- `backend/internal/modules/live`
- `backend/internal/modules/upload`
