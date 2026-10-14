# Multi-flux : grille de participants et tuiles périmées

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M4, M5, M15

## Problème
Un seul flux distant est affiché (PiP 120×90) sur 5 co-streamers, choisi arbitrairement. Les tuiles périmées ne sont pas retirées (pas de timer sur `mute`, `ended` non filtré, repli sur `remoteStreams[0]`) : un co-streamer parti laisse une image figée. Chaque `mute/unmute` recrée le tableau et re-rend tout l'écran.

## Correctif proposé
Grille de jusqu'à 6 tuiles ou échange au toucher, libellés, ne décoder que les tuiles visibles ; timer 5 s sur `mute` (comme le web), `onremovetrack`, filtrer `ended`, mémoïser les tuiles.

## Critères d'acceptation
- [ ] Avec 5 co-streamers tous sont visibles ou accessibles
- [ ] Un participant qui part disparaît en < 6 s
- [ ] Pas de re-rendu complet sur simple `mute`

## Fichiers concernés
- `mobile/app/live-streaming.tsx`
- `mobile/hooks/useWebRTC.ts`
