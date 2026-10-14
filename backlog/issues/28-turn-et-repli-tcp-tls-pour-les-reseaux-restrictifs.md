# TURN et repli TCP/TLS pour les réseaux restrictifs

> Source : `AUDIT_LIVE_WEBRTC.md` — constats N1, N2, M15

## Problème
Seul un STUN public est proposé : derrière un NAT symétrique, un Wi-Fi d'entreprise ou certains réseaux mobiles, ni publication ni lecture WebRTC ne fonctionne, avec pour seul retour « grâce de 8 s ». Le serveur n'offre que des candidats UDP host. `WEBRTC_IP` retombe sur `127.0.0.1` (déjà un avertissement, pas de contrôle en production).

## Correctif proposé
Déployer coturn (UDP/TCP/TLS 443), endpoint d'identifiants courts consommé par les clients, `SetICETCPMux` côté serveur, erreur explicite « connexion impossible » après ~15 s en `connecting`, vérification de `WEBRTC_IP` en production.

## Critères d'acceptation
- [ ] Publication et lecture fonctionnent avec l'UDP bloqué
- [ ] Les clients reçoivent des identifiants TURN éphémères

## Fichiers concernés
- `docker-compose.yml`
- `backend/internal/modules/room/room.go`
- `mobile/hooks/useWebRTC.ts`
- `front-web/src/hooks/useWebRTC.ts`
