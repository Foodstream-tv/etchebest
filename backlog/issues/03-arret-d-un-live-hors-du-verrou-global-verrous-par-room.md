# Arrêt d'un live hors du verrou global (verrous par room)

> Source : `AUDIT_LIVE_WEBRTC.md` — constats R3, H1, R13

## Problème
`HandleDisconnect` et `teardownEmptyRoom` tiennent le mutex global pendant `StopStream` (sleep 2 s, arrêt FFmpeg jusqu'à 5 s) et des appels BDD. Terminer un long live bloque join, ICE, renégociation, kick et le relais de tous les autres lives. (La copie du replay est déjà remplacée par un rename.)

## Correctif proposé
Détacher la room du registre sous verrou puis arrêter FFmpeg / finaliser / générer le replay / écrire en base hors verrou. Passer à un verrou par room ; marquer la room `closed` pour éviter les pointeurs périmés. Remplacer le `time.Sleep(2s)` par un drain basé sur le dernier segment.

## Critères d'acceptation
- [ ] Terminer un live n'interrompt pas les autres lives (test avec deux rooms)
- [ ] `go test -race` propre sur les scénarios join/reserve/cancel/kick concurrents

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `backend/internal/hls/manager.go`
