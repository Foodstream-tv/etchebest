# Kick fiable et persistant, suppression du code mort AddParticipant

> Source : `AUDIT_LIVE_WEBRTC.md` — constats A7, A8

## Problème
`KickParticipant` : correspondance `strings.Contains` bidirectionnelle sur le stream id, 200 sans cible, `KickedUsers` en mémoire uniquement, un expulsé peut re-réserver ou revenir après redémarrage, son WS n'est pas fermé. `AddParticipant` n'est pas enregistré mais permet d'ajouter n'importe quel `userId` sans contrôle.

## Correctif proposé
Correspondance exacte, 404 si aucune cible, persister les expulsions (colonne/table) et les faire respecter par reserve et join, fermer le WS. Supprimer `AddParticipant` ou le restreindre à l'hôte.

## Critères d'acceptation
- [ ] Un expulsé ne peut ni re-réserver ni rejoindre, même après redémarrage
- [ ] Kick sans cible renvoie 404

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `backend/internal/modules/room/websocket.go`
