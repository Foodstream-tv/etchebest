# CI : lancer les tests et les contrôles backend, mobile et web sur chaque PR

> Source : `AUDIT_LIVE_WEBRTC.md` — constats Tests

## Problème
La CI actuelle (`.github/workflows/ci.yml`) se contente de compiler le binaire du backend : aucun `go test`, aucun job mobile ni web. Les 570+ tests mobile, les tests Go et les vérifications de types ne protègent donc aucune PR.

## Correctif proposé
Jobs séparés : backend (`go vet`, `go test -race ./...`), mobile (`npm ci`, `npx tsc --noEmit`, `npx expo lint`, `npm test`), web (`npx tsc --noEmit`, lint) avec cache des dépendances ; exiger ces checks sur `main`.

## Critères d'acceptation
- [ ] Une PR qui casse un test ou un type échoue en CI
- [ ] Les checks sont requis par la protection de branche

## Fichiers concernés
- `.github/workflows/ci.yml`
