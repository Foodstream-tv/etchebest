# Supervision de FFmpeg : crash, redémarrage et arrêt propre

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H3, H11, H12

## Problème
`cmd.Wait()` n'est appelé qu'à l'arrêt : un crash FFmpeg est invisible (playlist figée, `IsRunning` reste vrai, processus zombie). `tryStartHLS` n'est pas retenté après échec. Pas de `Pdeathsig`. La boucle de retry UDP est morte (`Dial udp4` n'échoue jamais) et le relais écrit avant que FFmpeg soit lié (1re IDR perdue). Allocation de port avec TOCTOU et plage éphémère chevauchant 50000-50100.

## Correctif proposé
Goroutine d'attente sur le process, redémarrage avec backoff (`append_list`), log de la fin de stderr, état « HLS indisponible » exposé, `Pdeathsig=SIGKILL`, arrêt par SIGTERM. Attendre la liaison/le premier segment avant d'écrire. Plage de ports dédiée hors ICE avec allocateur.

## Critères d'acceptation
- [ ] Tuer FFmpeg pendant un live le relance et le replay reste continu (test avec faux binaire)
- [ ] Aucun processus orphelin après arrêt du backend
- [ ] Pas de perte de la première keyframe au démarrage

## Fichiers concernés
- `backend/internal/hls/streamer.go`
- `backend/internal/hls/manager.go`
