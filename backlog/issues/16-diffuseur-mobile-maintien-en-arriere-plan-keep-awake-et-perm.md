# Diffuseur mobile : maintien en arrière-plan, keep-awake et permissions

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M2, M11

## Problème
Aucun service de premier plan Android, aucun `UIBackgroundModes` iOS, pas d'`expo-keep-awake` : verrouiller l'écran ou changer d'app coupe caméra/micro (images noires, micro muet) et, ~5 s plus tard, le live. L'écran d'hôte s'éteint en plein direct. `inactive` (Centre de contrôle iOS) coupe aussi la vidéo inutilement.

## Correctif proposé
`useKeepAwake` pendant `connecting/live`, service de premier plan caméra+micro (+ `POST_NOTIFICATIONS` Android 13), plugin `@config-plugins/react-native-webrtc`, `UIBackgroundModes` (audio, voip), ne réagir qu'à `background`, état « en pause » explicite.

## Critères d'acceptation
- [ ] Verrouiller le téléphone 30 s pendant un live ne coupe pas la diffusion (Android et iOS)
- [ ] L'écran reste allumé pendant le live
- [ ] Checklist manuelle sur appareils réels documentée

## Fichiers concernés
- `mobile/app.json`
- `mobile/hooks/useWebRTC.ts`
- `mobile/app/live-streaming.tsx`
