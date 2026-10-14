# Perte de capture locale et interruptions (appel, autre app, permission révoquée)

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M6, M16

## Problème
Aucun écouteur `ended` sur les pistes locales : si une autre app prend la caméra, qu'un appel arrive ou que la permission est révoquée, l'aperçu fige et la pastille reste « LIVE ». La lumière de la caméra peut rester allumée.

## Correctif proposé
Écouter `ended`/`mute` sur les pistes locales, bannière claire, ré-acquisition (`getUserMedia` + `replaceTrack`) au retour au premier plan, gestion des interruptions iOS/Android.

## Critères d'acceptation
- [ ] Une caméra prise par une autre app affiche un état d'erreur explicite
- [ ] Au retour la capture est rétablie sans recréer la room

## Fichiers concernés
- `mobile/hooks/useWebRTC.ts`
