# Jetons : n'accepter `?token=` que pour le WebSocket (ticket court), cookies et logs

> Source : `AUDIT_LIVE_WEBRTC.md` — constats A9, A10, B4

## Problème
`?token=` est accepté sur toutes les routes `/api` et le logger gin écrit la query string : les JWT finissent dans stdout/proxies. Les cookies `token`/`auth_token` sont acceptés sur toutes les routes (CSRF possible avec CORS `*`). Le web met le JWT dans l'URL du WS. Logs : SDP complet et candidats ICE (IP clients) en INFO, `err.Error()` renvoyé aux clients, `console.log` des corps ICE côté web.

## Correctif proposé
`?token` uniquement sur la route WS, idéalement un ticket à usage unique ; pas de cookie sur les routes mutantes (ou en-tête CSRF) ; `GIN_MODE=release` + logger qui masque la query ; `jwt.WithValidMethods`; messages d'erreur génériques ; supprimer les `console.log`.

## Critères d'acceptation
- [ ] Les JWT n'apparaissent plus dans les logs
- [ ] Un appel mutant avec cookie seul est refusé
- [ ] Le WS fonctionne avec un ticket court

## Fichiers concernés
- `backend/internal/middleware/auth.go`
- `backend/internal/modules/room/websocket.go`
- `front-web/src/hooks/useWebRTC.ts`
- `front-web/src/services/streaming.ts`
