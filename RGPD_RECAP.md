# RGPD — Récapitulatif : ce qui existe et ce qu'il reste à faire

> Complète `AUDIT_RGPD.md` (constats détaillés avec fichiers et lignes). Ce document sert de **tableau de bord** : où on en est, ce qui est déjà en place, ce qui attend un merge, et ce qu'il faut encore décider ou produire.
> État au 15/10/2026. Ce n'est pas un avis juridique.

**Légende** : ✅ en place sur `main` · 🔀 corrigé dans une PR ouverte (à merger) · ⏳ à faire · 🧑‍⚖️ décision / rédaction humaine nécessaire

PRs concernées : #264 audit · #265 logs · #266 effacement + export + purge · #267 SSRF scraper · #268 mentions + politique · #269 Postgres local.

---

## 1. En résumé

- **Déjà bien** : aucun traceur tiers, mots de passe hachés (bcrypt), profil public minimal côté API, cookie de session httpOnly, réponses génériques sur « mot de passe oublié », pages CGU et confidentialité présentes.
- **Corrigé dans les PRs ouvertes** : suppression complète du compte, export des données, nettoyage des logs, purge des codes expirés, mentions légales à l'inscription, avertissement « live enregistré », politique de confidentialité complétée, deux failles de sécurité (SSRF, base de données exposée).
- **Reste à faire** : des décisions que seule l'équipe peut prendre (contact, durées, âge minimum, données collectées), des documents (registre, contrats), et un lot de durcissement sécurité plus lourd.

---

## 2. Droits des personnes

| Exigence | Aujourd'hui sur `main` | Après merge des PRs | Reste à faire |
|---|---|---|---|
| **Effacement** (art. 17) | ⚠️ Ne supprime que la ligne utilisateur (chats, replays, notifications, codes, listes d'abonnés restent). Mobile seulement. | 🔀 #266 : tout est supprimé en une transaction (profil, lives + fichiers, chats, notifications, codes, rooms, listes d'abonnés, photos). Web + mobile + admin. | Replays d'un tiers où la personne apparaît comme co-streamer (voir §5). Sauvegardes de base non purgées (infra). |
| **Accès / portabilité** (art. 15 et 20) | ❌ Promis dans la politique, non implémenté. | 🔀 #266 : `GET /api/users/me/export` + bouton web (profil) + bouton mobile (réglages). | — |
| **Rectification** (art. 16) | ✅ Modification du profil et du mot de passe (web + mobile). | — | — |
| **Opposition / limitation** | ⏳ Aucun mécanisme dédié. | — | 🧑‍⚖️ Via l'adresse de contact (à fournir, §4). |
| **Retrait du consentement** | ✅ Sans objet tant qu'aucun traceur non essentiel n'existe. | — | Si un traceur est ajouté un jour : monter `CookieConsentBanner` (existe, non utilisé). |

---

## 3. Transparence et information

| Exigence | Aujourd'hui sur `main` | Après merge des PRs | Reste à faire |
|---|---|---|---|
| Politique de confidentialité | ⚠️ Générique : pas de contact, pas de durées, pas de destinataires, ne parle pas des lives/replays/chat. | 🔀 #268 : données réellement traitées, section lives/replays/chat, destinataires (hébergeur, e-mails, Google dont STUN), conservation, transferts, droits en libre-service, CNIL. | 🧑‍⚖️ Identité et **adresse de contact** du responsable, DPO s'il y en a un, noms de l'hébergeur et du prestataire d'e-mails, durée de conservation des journaux. |
| Liens CGU / confidentialité à l'inscription | ❌ Seulement dans le footer de l'accueil web. | 🔀 #268 : web et mobile. | — |
| Information « live enregistré et rediffusé » | ❌ Aucune. | 🔀 #268 : avant de lancer le live (web studio, page de lancement, mobile) et pour le co-streamer connecté. | ⏳ Consentement explicite des co-streamers et option « pas de replay » (§5). |
| Politique accessible dans l'app mobile | ❌ | 🔀 #266 : liens dans les réglages. #268 : liens à l'inscription. | — |
| Mentions pour les stores (App Store / Play Store) | ⏳ | — | 🧑‍⚖️ Renseigner les fiches « confidentialité des données » avec les mêmes catégories que la politique. |

---

## 4. Décisions à prendre (je ne peux pas les trancher)

| # | Question | Pourquoi c'est bloquant |
|---|---|---|
| D1 | **Qui est le responsable de traitement ?** Nom, adresse, e-mail de contact (et DPO éventuel) | Obligatoire dans la politique ; sans contact, les droits ne sont pas exerçables hors des boutons. |
| D2 | **Durées de conservation** : journaux d'accès, chats, replays, notifications, comptes inactifs | La politique dit « durée nécessaire » sans chiffre ; aucune purge n'existe hors codes/tokens. |
| D3 | **Âge minimum** (13, 15, 16 ans ?) et contrôle à l'inscription | Service vidéo + chat public : en France, consentement parental sous 15 ans. |
| D4 | **Téléphone et bio obligatoires à l'inscription : indispensables ?** | Minimisation des données (art. 5) : si non indispensables, ne plus les exiger. |
| D5 | Les replays sont-ils **toujours** conservés et publics, ou l'hôte choisit-il ? | Détermine l'information, le consentement des co-streamers et la durée de conservation. |
| D6 | Nom et prénom réels **publics** sur le profil ? | Aujourd'hui affichés avec le pseudo ; le pseudo seul suffirait. |
| D7 | Hébergeur, fournisseur SMTP (et SMS ?), Google : pays de traitement | Nécessaire pour les transferts hors UE et le registre. |
| D8 | **STUN Google** conservé, ou serveur STUN/TURN maison ? | L'adresse IP des streamers part chez Google. |
| D9 | Hotlinking Unsplash conservé, ou images hébergées chez nous ? | L'adresse IP des visiteurs part chez Unsplash. |

---

## 5. Sécurité des données (art. 32)

| Sujet | Aujourd'hui sur `main` | Après merge des PRs | Reste à faire |
|---|---|---|---|
| JWT, emails et codes OTP dans les logs | ❌ Access log avec `?token=`, debug OAuth permanent, OTP loggés si SMTP absent | 🔀 #265 | Rétention des logs côté serveur (ex. 30 j) |
| Scraper Marmiton public (SSRF) | ❌ `strings.Contains` contournable | 🔀 #267 | — |
| Postgres exposé sur le réseau (mot de passe `root`) | ❌ port publié sur toutes les interfaces | 🔀 #269 | Changer le mot de passe par défaut en prod |
| Codes de vérification / tokens de reset conservés | ❌ jamais purgés, en clair | 🔀 #266 : purge (≤ 24 h après expiration) | 🔀 #285 : stockés **hachés** (HMAC-SHA256 clé JWT_SECRET), anciens codes en clair supprimés au démarrage |
| Token de session en `localStorage` (web, analytics) | ⚠️ exposé en cas de XSS | 🔀 #286 : cookie httpOnly seul, le navigateur ne garde que le profil | ✅ Fait (mobile : toujours en `Authorization`, stockage sécurisé de l'appareil) |
| JWT accepté dans l'URL (WebSocket) | ⚠️ finit dans l'historique, les referrers | 🔀 #265 le retire des logs, #286 le retire de l'URL (WebSocket et retour Google) | ✅ Ticket WebSocket de 30 s à usage unique ; `?token=` refusé |
| Durée cookie 30 j vs JWT 7 j | ⚠️ incohérent | 🔀 #286 : cookie de 7 j comme le JWT, cookie de session sans « Rester connecté » | ✅ Fait |
| Limitation de débit (login, inscription, renvoi de code, reset) | ❌ aucune | — | ⏳ À ajouter |
| CORS `*` | ⚠️ | 🔀 #286 : cookie accepté uniquement pour les origines autorisées | ⏳ Reste `*` sans cookie pour le mobile et l'API publique : à restreindre (#287) |
| Connexion Postgres `sslmode=disable` | ⚠️ | — | ⏳ TLS si la base n'est pas sur le même hôte |
| EXIF (GPS) dans les photos envoyées | ⚠️ conservé | — | ⏳ Retirer à l'upload |
| Backend en HTTP (compose par défaut) | ⚠️ | — | HTTPS via le compose VM (`docker-compose.vm.yml`) : vérifier qu'il est bien utilisé en prod |
| Admin (`analytics`) : liste des e-mails, aucun journal | ⚠️ | 🔀 Journal d'audit : chaque appel `/api/admin/*` (consultation comme suppression, y compris refusé) est enregistré avec qui, quoi, cible, résultat, IP ; conservé 1 an ; lisible via `GET /api/admin/audit-logs` | ⏳ Mentionner le journal et sa durée dans la politique de confidentialité |

---

## 6. Lives, replays, co-streamers

| Sujet | Aujourd'hui | Reste à faire |
|---|---|---|
| Replays publics (HLS et fichiers sans authentification) | ✅ comportement voulu | Durée de conservation (D2, D5) |
| Co-streamers filmés et rediffusés | 🔀 information avant diffusion (#268) | ⏳ **Consentement** explicite du co-streamer à rejoindre « un live enregistré » ; possibilité de demander le retrait d'un replay où il apparaît |
| Replay d'un tiers après suppression du co-streamer | ❌ la personne reste visible | ⏳ Procédure de retrait sur demande (adresse de contact D1) |
| Chat | ⚠️ conservé sans limite, visible des participants | ⏳ Durée (D2) ; suppression à l'effacement du compte ✅ 🔀 #266 |

---

## 7. Documents et organisation (hors code)

| Document | État | Qui |
|---|---|---|
| **Registre des traitements** (art. 30) | ⏳ inexistant | équipe / DPO — la cartographie de `AUDIT_RGPD.md` §1 sert de base |
| **Contrats de sous-traitance** (art. 28) : hébergeur, SMTP/SMS, Google | ⏳ à vérifier | équipe |
| **Procédure de violation de données** (notification CNIL sous 72 h) | ⏳ inexistante | équipe |
| **Analyse d'impact (AIPD)** | 🧑‍⚖️ à évaluer : diffusion vidéo en direct de personnes à grande échelle, éventuellement mineurs | DPO / conseil |
| **Procédure de réponse aux demandes** (délai 1 mois) | ⏳ à écrire ; l'export et l'effacement libre-service couvrent l'essentiel | équipe |
| Nomination d'un **DPO** | 🧑‍⚖️ pas obligatoire a priori, à confirmer | équipe |

---

## 8. Ordre conseillé

1. **Merger** #265, #266, #267, #269, puis #268 (si conflit sur `mobile/i18n/messages/shared.*.ts`, résoudre dans #268). Merger #264 pour garder l'audit.
2. **Répondre à D1 à D4** (contact, durées, âge, champs obligatoires) → je complète la politique, les CGU et l'inscription.
3. **Tester à la main** : créer un compte jetable, télécharger l'export, supprimer le compte (web puis mobile), vérifier la disparition du live et du replay.
4. **Lot sécurité** (§5 « à faire ») en PRs séparées : tokens hachés + cookie seul + ticket WebSocket, rate limiting, CORS, EXIF.
5. **Lot lives** : consentement des co-streamers, option « pas de replay », rétention (selon D5).
6. **Documents** (§7) : registre, contrats, procédure de violation.
