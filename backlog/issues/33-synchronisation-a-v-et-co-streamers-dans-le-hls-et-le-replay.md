# Synchronisation A/V et co-streamers dans le HLS et le replay

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H13, H14

## Problème
Seul l'hôte est dans le HLS : les co-streamers (jusqu'à 5) ne sont ni visibles ni audibles pour les spectateurs HLS et le replay. `use_wallclock_as_timestamps` sans RTCP SR transmis risque une dérive audio/vidéo (non mesurée).

## Correctif proposé
Compositeur/mixeur des pistes des co-streamers (ou documenter la limite), transmettre les RTCP SR à FFmpeg ou ajouter un petit jitter buffer, mesurer la dérive.

## Critères d'acceptation
- [ ] Les co-streamers apparaissent dans le HLS ou la limite est documentée et affichée
- [ ] Dérive A/V < 100 ms sur un live de 30 min

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `backend/internal/hls/streamer.go`
