# Qualité WebRTC du SFU : intercepteurs Pion, debounce PLI/FIR, recover des goroutines

> Source : `AUDIT_LIVE_WEBRTC.md` — constats R10, R11, R12

## Problème
Aucun intercepteur Pion (NACK, TWCC, REMB, RR) : gels et artefacts sur réseaux mobiles avec pertes. Chaque join/answer déclenche une rafale de 10 PLI+FIR par piste et les PLI/FIR des abonnés sont relayés sans limite : la source émet des keyframes en continu. Les goroutines relais/RTCP/renégociation n'ont pas de `recover` : un bug de parsing (H264/STAP-A/VP8) tue le serveur.

## Correctif proposé
`webrtc.RegisterDefaultInterceptors`, debounce à 1 keyframe/s par SSRC source, wrapper `safeGo` avec `recover` et log.

## Critères d'acceptation
- [ ] Les paquets perdus sont retransmis (NACK) et la qualité s'adapte au débit
- [ ] N joins simultanés ne génèrent pas N rafales de keyframes
- [ ] Une panique dans un relais n'arrête pas le serveur (test)

## Fichiers concernés
- `backend/internal/modules/room/room.go`
