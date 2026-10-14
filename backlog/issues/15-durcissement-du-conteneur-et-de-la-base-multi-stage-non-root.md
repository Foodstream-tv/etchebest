# Durcissement du conteneur et de la base : multi-stage, non-root, mode release

> Source : `AUDIT_LIVE_WEBRTC.md` — constats H22, A10

## Problème
Dockerfile mono-étage sur `golang:alpine` (toolchain et sources dans l'image), exécuté en root, sans init (zombies FFmpeg). Postgres publié sur 0.0.0.0 avec `root/root` par défaut, secrets passés par `env_file`+`environment`, build args du front codés sur `localhost`. `GIN_MODE` non défini (mode debug en prod). `gorm.Open` : erreurs non propagées, pas de pool ni de retry. Schéma via `AutoMigrate` avec erreurs d'index ignorées.

## Correctif proposé
Build multi-étapes vers `alpine` (ffmpeg, ca-certificates, tini), utilisateur non-root (droits sur le volume), `GIN_MODE=release`, publier Postgres sur 127.0.0.1 (ou ne pas le publier), supprimer les mots de passe par défaut, propager les erreurs DB + pool, adopter des migrations versionnées, `validate` des chemins avec `uuid.Parse`.

## Critères d'acceptation
- [ ] L'image finale ne contient ni toolchain ni sources et ne tourne pas en root
- [ ] Postgres n'est pas joignable depuis le réseau externe par défaut
- [ ] Une erreur de connexion DB fait échouer le démarrage

## Fichiers concernés
- `backend/Dockerfile`
- `docker-compose.yml`
- `backend/internal/db`
