# Écran hôte mobile : chat, compteur de spectateurs et expulsion

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M3

## Problème
L'écran de diffusion n'a ni chat, ni nombre de spectateurs, ni moyen d'expulser un co-streamer (le web a les trois). C'est le flux principal du produit.

## Correctif proposé
Panneau de chat repliable (réutiliser `ChatPanel`), compteur via `/rooms/:id`, ajouter `kickParticipant` au service et une action par participant avec confirmation.

## Critères d'acceptation
- [ ] L'hôte lit et envoie des messages pendant le live
- [ ] Le nombre de spectateurs est visible et mis à jour
- [ ] L'hôte peut expulser un co-streamer

## Fichiers concernés
- `mobile/app/live-streaming.tsx`
- `mobile/services/streaming.ts`
- `mobile/components/live/ChatPanel.tsx`
