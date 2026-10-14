# Chat : performances, séquence des réponses et dédoublonnage

> Source : `AUDIT_LIVE_WEBRTC.md` — constats C1, C2, C3

## Problème
Chaque sondage (5 s) remplace tout le tableau (re-rendu complet de la liste, sans `since`, sans plafond, sondage actif onglet masqué) ; pas de garde de séquence (une vieille réponse écrase une récente) ni de garde « déjà en vol » (`usePolling`). Dédoublonnage des messages en attente par texte seul ; pas de rate limit client ni de modération/signalement. La page hôte web interroge `/rooms` (liste complète) toutes les 3 s.

## Correctif proposé
Comparer le dernier id et ne pas re-rendre si inchangé, `?after=` côté backend, plafonner ~200 lignes, garde de séquence et garde « en vol », pause hors focus/onglet masqué, identifiant client pour le dédoublonnage, limite d'envoi, `/rooms/:id` côté web.

## Critères d'acceptation
- [ ] La liste ne se re-rend pas quand rien n'a changé
- [ ] Deux messages identiques consécutifs s'affichent correctement
- [ ] Pas de requêtes empilées sur réseau lent

## Fichiers concernés
- `mobile/components/live/ChatPanel.tsx`
- `mobile/hooks/usePolling.ts`
- `backend/internal/modules/chat`
