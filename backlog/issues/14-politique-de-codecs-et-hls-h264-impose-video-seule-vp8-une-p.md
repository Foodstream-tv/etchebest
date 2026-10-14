# Politique de codecs et HLS : H264 imposé, vidéo seule, VP8, une piste hôte source

> Source : `AUDIT_LIVE_WEBRTC.md` — constats N4, H15, R9, N5

## Problème
Un publieur VP8/VP9 obtient un live « live » sans HLS ni replay ; `resolveCodec` retombe sur PT 0 (piste liée à rien) ; profils H264 mixtes non filtrés. `tryStartHLS` exige ≥ 2 pistes : un hôte sans micro n'a pas de HLS. Toute piste hôte devient source HLS : deux caméras entrelacent leur RTP et corrompent le flux.

## Correctif proposé
MediaEngine restreint à Opus + H264 (`42e01f`, packetization-mode=1) côté publieur, rejet visible sans codec commun, démarrer le HLS en vidéo seule, choisir une piste audio et une vidéo comme source, exposer un état « HLS indisponible » dans l'API et l'UI, filtrer l'audio par PT.

## Critères d'acceptation
- [ ] Un publieur sans codec commun reçoit une erreur claire à la connexion
- [ ] Un hôte sans micro obtient quand même HLS et replay
- [ ] Deux pistes vidéo n'altèrent pas le HLS

## Fichiers concernés
- `backend/internal/modules/room/room.go`
