# Parité des replays sur mobile : reprise, vitesse, qualité

> Source : `AUDIT_LIVE_WEBRTC.md` — constats P4

## Problème
Sur natif il n'y a ni reprise de position, ni vitesse de lecture, ni sélecteur de qualité (le web en a un).

## Correctif proposé
Mémoriser la position par replay, menu vitesse, sélecteur de qualité si disponible via expo-video.

## Critères d'acceptation
- [ ] Reprendre un replay au point où on l'a quitté

## Fichiers concernés
- `mobile/components/HLSPlayer.tsx`
