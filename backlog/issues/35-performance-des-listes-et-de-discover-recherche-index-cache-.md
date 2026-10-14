# Performance des listes et de discover : recherche, index, cache, catégories

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H21, H18, H22

## Problème
`ILIKE '%q%'` non échappé (wildcards, scan séquentiel), `status` non validé, `status=all` exclut `ended`. `GetDiscover` fait des `GROUP BY` complets sans cache à chaque appel ; `GetCategoryLives` compte tous les statuts. `CountryID`/`DishID` ne sont jamais renseignés (catégories toujours vides). `room_id` non unique, pas d'index composites `(status, scheduled_at/created_at)`.

## Correctif proposé
Échapper les wildcards et passer à `pg_trgm`/full-text, valider `status`, cache court pour discover, renseigner pays/plat à la création, `uniqueIndex` sur `room_id` et index composites.

## Critères d'acceptation
- [ ] Les requêtes de liste utilisent des index (EXPLAIN)
- [ ] Les catégories de discover contiennent des lives

## Fichiers concernés
- `backend/internal/modules/live`
- `backend/internal/modules/discover`
