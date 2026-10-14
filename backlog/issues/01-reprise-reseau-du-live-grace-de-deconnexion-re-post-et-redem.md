# Reprise réseau du live : grâce de déconnexion, re-POST et redémarrage ICE

> Source : `AUDIT_LIVE_WEBRTC.md` — constats R1, M1

## Problème
`Disconnected` est traité comme terminal (`room.go:2263`). Une coupure de ~5 s (Wi-Fi→4G, tunnel) retire le peer ; si l'hôte est seul, la room est supprimée, le replay est tronqué et la reconnexion répond 404. Le client mobile n'a ni NetInfo ni `restartIce()`, et sa grâce de 8 s est plus longue que celle du serveur : « Réessayer » crée une nouvelle room (replay coupé en deux).

## Correctif proposé
Backend : n'agir que sur `Failed`/`Closed`, timer 20-30 s sur `Disconnected` annulé si retour `Connected`, accepter un re-POST `/webrtc` du même utilisateur qui remplace son peer. Mobile : `@react-native-community/netinfo`, re-publication (ICE restart ou nouveau PC) avec backoff, message clair « connexion perdue » si abandon.

## Critères d'acceptation
- [ ] Une coupure réseau de 10 s pendant un live ne termine pas la room ni le replay
- [ ] Après retour du réseau le flux reprend dans la même room (test manuel sur appareil)
- [ ] Au-delà de la grâce, le live se termine proprement et l'utilisateur est informé
- [ ] Tests Go (machine d'états) et jest (reprise/abandon)

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `mobile/hooks/useWebRTC.ts`
