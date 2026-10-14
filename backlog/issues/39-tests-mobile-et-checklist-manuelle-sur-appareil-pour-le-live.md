# Tests mobile et checklist manuelle sur appareil pour le live

> Source : `AUDIT_LIVE_WEBRTC.md` — constats Tests

## Problème
Les tests mockent le hook `useWebRTC`/`StreamView` ou le PeerConnection : ils ne révèlent ni les vrais événements `ended`/`mute` de react-native-webrtc, ni les transitions `AppState`, ni un changement de réseau, une permission révoquée, un flux distant retiré, le 409 côté UI, l'échec de renégociation ou le gel du lecteur. Les comportements natifs (service de premier plan, routage audio, interruptions iOS, Bluetooth) ne sont pas testables avec jest.

## Correctif proposé
Ajouter les tests manquants côté jest (AppState du hook, `preferH264` sur de vrais SDP, 409, renégociation, gel du lecteur) et une checklist manuelle versionnée (appareils Android/iOS) exécutée avant chaque release ; envisager un test e2e (Detox/Maestro).

## Critères d'acceptation
- [ ] Checklist manuelle dans le dépôt, exécutée avant release
- [ ] Les scénarios listés sont couverts par des tests

## Fichiers concernés
- `mobile/hooks/__tests__/useWebRTC.test.ts`
- `mobile/app/__tests__/live-streaming.test.tsx`
