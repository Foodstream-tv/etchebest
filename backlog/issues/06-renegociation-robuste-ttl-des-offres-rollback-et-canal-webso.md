# Renégociation robuste : TTL des offres, rollback et canal WebSocket côté mobile

> Source : `AUDIT_LIVE_WEBRTC.md` — constats R5, M12, M13, M14

## Problème
Une offre en attente n'expire jamais : si le client ne répond pas, il est bloqué pour toujours. `HandleRenegotiationAnswer` ne nettoie pas l'état en cas d'échec et accepte une answer sans offre en attente. Mobile : polling toutes les 1,2 s (~50 req/min), sans vérifier `signalingState`, sans rollback si `createAnswer` échoue, sans backoff sur 401/404 ; le canal WebSocket (seul à porter `kicked`) n'est pas utilisé.

## Correctif proposé
TTL ~10 s + rollback (`SetLocalDescription(rollback)`), identifiant d'offre, answer refusée sans offre en attente. Mobile : WebSocket en priorité, polling 3-5 s avec backoff en repli, rollback en cas d'échec, message clair quand l'utilisateur est expulsé.

## Critères d'acceptation
- [ ] Une offre non répondue est réémise ou annulée après le TTL
- [ ] Un participant expulsé voit un message explicite (pas de boucle de retry en 403)
- [ ] Le polling consomme < 15 req/min en régime stable

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `backend/internal/modules/room/websocket.go`
- `mobile/hooks/useWebRTC.ts`
