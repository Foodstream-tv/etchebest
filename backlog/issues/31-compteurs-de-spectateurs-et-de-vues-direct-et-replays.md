# Compteurs de spectateurs et de vues (direct et replays)

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H9

## Problème
`view_count`, `current_viewers`, `replay_views` et `Room.Viewers` ne sont jamais écrits (les spectateurs HLS sont de simples requêtes statiques) : les tris « vues/spectateurs », les totaux et les badges sont toujours à 0.

## Correctif proposé
Heartbeat spectateur (`POST /lives/:id/view` toutes les 15 s, ensemble avec TTL) pour `current_viewers`, vues uniques par utilisateur/IP, `replay_views` au démarrage du replay, écritures `UPDATE … SET x = x+1`.

## Critères d'acceptation
- [ ] Le nombre de spectateurs reflète les lecteurs actifs (± 15 s)
- [ ] Les tris par vues/spectateurs fonctionnent

## Fichiers concernés
- `backend/internal/modules/live`
- `backend/internal/modules/discover`
- `mobile/components/HLSPlayer.tsx`
