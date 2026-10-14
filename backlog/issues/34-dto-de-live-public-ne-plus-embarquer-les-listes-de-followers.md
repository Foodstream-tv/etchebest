# DTO de live public : ne plus embarquer les listes de followers

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H19

## Problème
`LiveToDTO` inclut `UserDTO` avec `followingIds` et `followersIds` de l'hôte dans `/api/lives`, `/api/lives/:roomId` et discover (publics, sans authentification) : un hôte avec 100 000 followers met 100 000 identifiants dans chaque carte.

## Correctif proposé
DTO résumé (id, pseudo, avatar, drapeaux, compteurs) pour les lives et les listes.

## Critères d'acceptation
- [ ] Le JSON d'un live ne contient plus de listes d'identifiants de followers
- [ ] Le client web et mobile fonctionnent sans ces champs

## Fichiers concernés
- `backend/internal/modules/live/dto.go`
- `backend/internal/modules/user/dto.go`
