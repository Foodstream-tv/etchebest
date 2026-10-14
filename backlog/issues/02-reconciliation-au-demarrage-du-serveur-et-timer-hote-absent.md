# Réconciliation au démarrage du serveur et timer « hôte absent »

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H2, R8, R13

## Problème
Aucun rapprochement d'état au boot : après un redémarrage, les lives `live` le restent pour toujours, les rooms persistent en base, l'hôte reçoit 409 à chaque création, les dossiers HLS ne deviennent jamais des replays. Si l'hôte tombe alors qu'un co-streamer reste, la room n'est pas terminée (`Connections != 0`), FFmpeg tourne sans entrée. Les lives `scheduled` jamais démarrés ne sont jamais purgés.

## Correctif proposé
Au démarrage : clôturer les lives `live` périmés, supprimer les rooms orphelines, générer le replay des dossiers HLS restants. Timer « hôte absent » (~60 s) qui termine le live. Janitor périodique pour les lives planifiés dépassés et les dossiers orphelins.

## Critères d'acceptation
- [ ] Redémarrer le backend en plein live laisse la base cohérente (live terminé, replay généré si possible)
- [ ] L'hôte peut recréer un live immédiatement après un crash
- [ ] Un live dont l'hôte est parti est terminé après le délai
- [ ] Test d'intégration de réconciliation

## Fichiers concernés
- `backend/cmd/server/main.go`
- `backend/internal/modules/room/room.go`
- `backend/internal/hls`
