# Audio mobile : routage haut-parleur / écouteur / Bluetooth et réinitialisation

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M10

## Problème
Aucune gestion de session audio : un co-streamer entend l'hôte sur l'écouteur ou à bas volume selon les défauts de l'OS, le Bluetooth n'est pas routé volontairement, et le mode « communication » peut rester actif après `stopLive` (musique d'autres apps atténuée).

## Correctif proposé
Couche de routage audio (haut-parleur par défaut, casque/Bluetooth suivis), réinitialiser le mode à la libération.

## Critères d'acceptation
- [ ] Le son sort sur le haut-parleur par défaut et suit un casque branché
- [ ] Après un live, l'audio des autres apps est normal

## Fichiers concernés
- `mobile/hooks/useWebRTC.ts`
