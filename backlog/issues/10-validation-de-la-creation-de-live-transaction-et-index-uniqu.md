# Validation de la création de live, transaction et index unique partiel (409)

> Source : `AUDIT_LIVE_WEBRTC.md` — constats A5, A6, H18

## Problème
`CreateNewRoom` : aucune limite de longueur, `Status` libre (peut publier un live « live » ou « ended » sans flux), `scheduledAt` passé accepté, durée négative/énorme, tags illimités, `ThumbnailURL` libre, Room/Live/Tags hors transaction (room orpheline si échec). Le 409 « live déjà actif » est vérifié puis inséré sans atomicité (double clic = deux lives), une ligne périmée bloque à vie, et le 409 ne renvoie pas le `roomId` existant.

## Correctif proposé
DTO avec `binding` (nom 3-80, titre ≤120, description ≤2000, ≤10 tags), statut en liste blanche (`scheduled`, `live` seulement après connexion de l'hôte), date future, transaction, index unique partiel `(user_id) WHERE status IN ('live','scheduled')`, renvoyer le `roomId` existant dans le 409.

## Critères d'acceptation
- [ ] Impossible de créer un live « ended » ou avec une date passée
- [ ] Un double POST simultané crée un seul live
- [ ] Le 409 permet au client de reprendre ou terminer le live existant

## Fichiers concernés
- `backend/internal/modules/room/room.go`
- `backend/internal/modules/live/model.go`
