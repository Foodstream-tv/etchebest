# Fuites et abus dans HandleWebRTC : validation d'abord, un PC par utilisateur, mux UDP

> Source : `AUDIT_LIVE_WEBRTC.md` — constats R7, N3

## Problème
La place est consommée et le live passe « live » avant validation du SDP ; sur les retours d'erreur le PC n'est jamais fermé (sockets UDP gardés) ; pas de limite de taille de SDP ni de nombre de PC par utilisateur. Sans mux UDP, ~50 PC max sur 101 ports : une boucle de POST épuise les ports de toutes les rooms. Une mauvaise `WEBRTC_PORT_*` est seulement loguée.

## Correctif proposé
Valider le SDP avant tout effet de bord, fermer et désenregistrer le PC sur toute erreur, `MaxBytesReader` (~64 Ko), un PC par utilisateur, mux UDP unique (`NewICEUDPMux`), échec rapide sur configuration de ports invalide.

## Critères d'acceptation
- [ ] Un SDP invalide ne consomme ni place ni statut
- [ ] Aucune socket UDP n'est laissée ouverte après une erreur
- [ ] Test de charge : N POST répétés ne dégradent pas les autres rooms

## Fichiers concernés
- `backend/internal/modules/room/room.go`
