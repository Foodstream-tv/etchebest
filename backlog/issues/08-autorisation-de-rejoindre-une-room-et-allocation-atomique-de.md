# Autorisation de rejoindre une room et allocation atomique des places

> Source : `AUDIT_LIVE_WEBRTC.md` — constats A1, A2

## Problème
Tout utilisateur connecté qui POST `/webrtc?roomId=X` devient publieur tant que < 5 places (pas de réservation, d'approbation ni de contrôle de statut). Un tiers peut remplir les 5 places. Limite incohérente : `ReserveRoom` autorise 5 hors hôte, `ensureParticipant` compte l'hôte (6 vs 5) ; lecture-modification-écriture non atomique ; `5` en dur à ~6 endroits.

## Correctif proposé
Autoriser seulement l'hôte ou les utilisateurs réservés, statut `scheduled/live`. Une constante, allocation atomique (transaction `SELECT … FOR UPDATE` ou table de jointure avec index unique `(room, user)`).

## Critères d'acceptation
- [ ] Un utilisateur non réservé reçoit 403 sur `/webrtc`
- [ ] Deux réservations simultanées de la dernière place : une seule réussit
- [ ] Les 5 co-streamers réservés peuvent tous rejoindre

## Fichiers concernés
- `backend/internal/modules/room/room.go`
