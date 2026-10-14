# Web : l'hôte libère caméra et room en cas d'erreur, lecteur replay et nettoyage

> Source : `AUDIT_LIVE_WEBRTC.md` — constats B2, B3, B4, B5, P5

## Problème
Dans le hook web, un échec ne fait que `setState('error')` : caméra, micro et PeerConnection restent ouverts et la room créée est orpheline ; `disconnected` ne libère rien et ne notifie pas le backend. Replay : erreurs réseau non retentées, `<track kind="captions">` vide ; configuration hls.js incohérente entre `front-web` et le lecteur mobile web ; `setTimeout(playVideo)` non nettoyé ; `createRoom` ne transmet que `{name}` et affiche « Failed to create room (409) » brut.

## Correctif proposé
Faire passer tous les échecs par le même nettoyage que `stopLive` (y compris `disconnectRoom`), politique de retry bornée partagée avec le mobile, config hls.js unique, vrais sous-titres ou suppression de la balise, nettoyer les timers, transmettre titre/description/tags et mapper le 409.

## Critères d'acceptation
- [ ] Un échec de démarrage ne laisse ni caméra allumée ni room orpheline
- [ ] Les erreurs réseau du replay sont retentées avec plafond

## Fichiers concernés
- `front-web/src/hooks/useWebRTC.ts`
- `front-web/src/app/(app)/replays/[id]/page.tsx`
- `front-web/src/services/streaming.ts`
