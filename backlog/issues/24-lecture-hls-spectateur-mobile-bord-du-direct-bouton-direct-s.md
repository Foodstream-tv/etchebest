# Lecture HLS spectateur mobile : bord du direct, bouton « Direct », stalls, orientation

> Source : `AUDIT_LIVE_WEBRTC.md` — constats P1, P2

## Problème
Sur natif il n'y a ni `targetOffsetFromLive`, ni bouton « Direct », et la playlist est de type EVENT (iOS démarre au début). Le chien de garde n'est pas réarmé après `readyToPlay` : un gel sans erreur n'est jamais rechargé. `orientation: portrait` rend le layout paysage inaccessible et le lecteur change de position dans l'arbre selon l'orientation (remontage sur iPad). Aucun choix explicite sur la lecture en arrière-plan / PiP.

## Correctif proposé
Définir `targetOffsetFromLive`, bouton « Direct » (seek au bord), surveiller `isLive`/buffering et recharger après ~10 s de gel, autoriser le paysage sur l'écran du live avec le lecteur à position stable, décider et configurer arrière-plan/PiP (`expo-video` plugin). Dépend de la fenêtre glissante HLS côté backend.

## Critères d'acceptation
- [ ] Un spectateur qui arrive en cours de live démarre au bord du direct
- [ ] Un gel de lecture déclenche un rechargement automatique
- [ ] Le plein écran paysage fonctionne sans redémarrer la lecture

## Fichiers concernés
- `mobile/components/HLSPlayer.tsx`
- `mobile/app/live-viewer.tsx`
- `mobile/app.json`
