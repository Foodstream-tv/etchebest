# Visibilité des lives : privé / non listé (décision produit)

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H18

## Problème
`Visibility` est accepté à la création mais jamais persisté ni appliqué : tous les lives et replays sont publics et `/api/hls/*` et `/replays-storage/*` n'exigent aucune authentification (une URL divulguée donne un accès permanent).

## Correctif proposé
Décider si les lives privés/non listés sont un besoin ; si oui, persister `visibility`, filtrer les listes, protéger HLS/replay (URLs signées ou jeton court) et l'exposer dans Studio. Sinon retirer le champ.

## Critères d'acceptation
- [ ] Décision produit documentée
- [ ] Si retenu : un live privé n'est visible que par ses invités

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `backend/internal/modules/live`
