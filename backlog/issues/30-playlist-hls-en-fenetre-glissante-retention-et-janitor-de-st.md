# Playlist HLS en fenêtre glissante, rétention et janitor de stockage

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H6, H22

## Problème
Playlist EVENT illimitée (`hls_list_size 0`, pas de `delete_segments`) : chaque spectateur retélécharge toute la playlist (~300 Ko / 2 s sur 3 h), iOS démarre au début, aucune rétention des dossiers HLS ni des replays. Divers : master écrit avant les variantes, `stream.sdp` servi publiquement et copié dans chaque replay, goroutine de log toutes les 2 s par live.

## Correctif proposé
Fenêtre glissante pour le direct, replay construit depuis un enregistrement séparé (second output ou copie), `EXT-X-START`, janitor + politique de rétention/quota pour `hls` et `storage/replays`, écrire `stream.sdp` hors du dossier servi.

## Critères d'acceptation
- [ ] La playlist d'un live de 3 h reste < 20 Ko
- [ ] Le replay contient bien tout le live
- [ ] Les dossiers orphelins sont nettoyés automatiquement

## Fichiers concernés
- `backend/internal/hls/streamer.go`
- `backend/internal/hls/manager.go`
