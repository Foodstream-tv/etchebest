# Audit RGPD — Foodstream

> Audit technique du code (backend Go, front-web, analytics, mobile) à la date du 15/10/2026.
> Ce n'est **pas un avis juridique** : il relève ce que le code fait réellement et l'écart avec ce que la politique de confidentialité annonce. Les points « juridique » doivent être validés par la personne responsable du traitement (ou un DPO / conseil).
> Non vérifié : l'infrastructure de production (hébergeur, sauvegardes, logs réellement conservés), le fournisseur SMTP/SMS, les contrats de sous-traitance, les stores (fiches de confidentialité).

Légende : 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible / bonne pratique.

---

## 1. Cartographie des données personnelles

| Donnée | Où | Finalité | Visible par | Conservation actuelle |
|---|---|---|---|---|
| Email, mot de passe (bcrypt), prénom, nom, pseudo, téléphone, indicatif | table `users` (`modules/user/model.go`) | compte, auth | l'utilisateur ; l'admin (email dans `analytics`) | jusqu'à suppression du compte |
| Photo de profil, description | `users` + fichier `storage/uploads` | profil public | tous | **fichier jamais supprimé** |
| Identifiants Google (`GoogleID`, provider, photo) | `users` | connexion OAuth | l'utilisateur | idem compte |
| Relations (abonnés/abonnements) | `users.following_ids / followers_ids` | social | tous (profil public) | **non nettoyé à la suppression** |
| Code de vérification (email/SMS) + destinataire | `verification_codes` | vérif. compte | — | **jamais purgé**, en clair |
| Token de reset + email | `password_reset_tokens` | reset mot de passe | — | **jamais purgé**, en clair |
| Messages de chat (500 car.) + `user_id` | `chats` | chat live | tous les connectés | **illimitée** |
| Notifications d'activité (follow) | `activities` | notifs | l'utilisateur | **illimitée** (lues sur 30 j mais jamais supprimées) |
| Lives : titre, description, replay, miniature, `user_id` | `lives` + `storage/replays` | diffusion, replay | **public sans authentification** | **illimitée** |
| Flux audio/vidéo (visage, voix) des hôtes et co-streamers | WebRTC → HLS → replays | diffusion | **public** (HLS et replays sans auth) | replays illimités |
| Ban : raison, dates | `users` | modération | admin | illimitée |
| Adresse IP + URL de chaque requête | logs `gin.Default()` | — (non voulu) | exploitants | selon l'infra |
| Token de session | cookie `token` httpOnly (30 j), `localStorage` (web, analytics), SecureStore (mobile) | session | — | JWT 7 j |
| Panier, préférences (thème, langue), lecture des notifs | `localStorage`, cookies `theme` / `locale` | confort | — | 1 an |

Aucun SDK d'analytics, de pub ou de crash reporting (ni dans le mobile, ni dans le web, ni dans analytics) : **pas de traceur tiers**. C'est un point fort.

Tiers destinataires réels (code) : Google (OAuth, serveur STUN `stun.l.google.com`, liens Google Calendar), Unsplash (images hotlinkées), fournisseur SMTP, hébergeur, Marmiton (scraping côté serveur).

---

## 2. Constats

### 🔴 Critiques

**C1. La suppression de compte ne supprime presque rien** — `modules/user/repository.go:26` (`db.Delete(&User{})`), pas de clés étrangères (`db.go` : `DisableForeignKeyConstraintWhenMigrating: true`).
Après `DELETE /api/users/me` il reste : messages de chat, lives et **replays publics contenant son visage/sa voix**, miniatures, notifications, codes de vérification et tokens de reset (avec son email), son nom dans les listes d'abonnés/abonnements des autres comptes, sa photo sur disque. Le droit à l'effacement (art. 17) n'est donc pas respecté. De plus, la suppression n'existe **pas dans l'interface web** (seulement mobile, `settings-delete-account`).
*À faire* : service unique « effacer un utilisateur » (transaction) qui supprime ou anonymise chats, activités, codes, tokens, retire l'ID des tableaux `followers/following`, supprime ou anonymise lives + fichiers replay/miniature, supprime la photo ; l'exposer sur web et mobile ; tests.

**C2. Pas de droit à la portabilité / à l'accès alors que la politique le promet** — aucune route d'export (`routes.go`). La page `/confidentialite` annonce « accès, portabilité… ».
*À faire* : `GET /api/users/me/export` (JSON : profil, chats, lives, activités, abonnements) + bouton dans les réglages ; sinon retirer la promesse et fournir une adresse de contact réelle.

**C3. Données personnelles dans les logs** — `auth/auth.go:110, 581, 586` (email en clair), `auth/oauth_web.go:192` (`[DEBUG] email=… picture=…` toujours actif), `room/room.go:565` (email), `notify/notifier.go:39-47, 66+, 107+, 158+` (code OTP et email logués si le SMTP n'est pas configuré : en prod, une mauvaise config écrit les codes dans les logs).
Et surtout `cmd/server/main.go:44` `gin.Default()` journalise **IP + URL complète de chaque requête, y compris `?token=<JWT>`** (le WebSocket passe le JWT en query string, `middleware/auth.go:20`). Les JWT valides 7 jours se retrouvent dans les logs.
*À faire* : supprimer le DEBUG, utiliser `MaskEmail` partout (il existe déjà dans `notifier.go`), retirer les OTP des logs hors `DEV_MODE`, logger sans query string (ou masquer `token`), définir une rétention de logs (ex. 30 j).

### 🟠 Élevés

**E1. Replays et flux publics sans information ni consentement visible** — `routes.go` : `/api/hls` et `/replays-storage` publics. Les co-streamers sont filmés et rediffusés ; **aucun avertissement « ce live est enregistré »** n'existe avant de passer en direct (web et mobile, vérifié dans les textes i18n), ni de choix de l'hôte pour la rediffusion. *À faire* : information claire avant diffusion + consentement des co-streamers + option de ne pas conserver le replay ; durée de conservation des replays.

**E2. Aucune politique de conservation appliquée** — aucun job de purge (`grep Ticker/purge`). Codes et tokens expirés, chats, activités, lives, bans s'accumulent. La politique dit « durée nécessaire » sans durée. *À faire* : job quotidien (codes/tokens expirés > 24 h, activités > 90 j, chats/replays selon durée choisie), et durées chiffrées dans la politique.

**E3. Politique de confidentialité incomplète** — `front-web/src/app/confidentialite/page.tsx`. Manquent : identité et contact réels du responsable (aucune adresse), contact DPO s'il y en a un, **durées de conservation**, **liste des destinataires** (Google, SMTP, hébergeur), les **flux audio/vidéo, replays et chat**, les **transferts hors UE** (Google : STUN, OAuth, Calendar ; Unsplash), le droit de réclamation auprès de la CNIL, le caractère facultatif ou obligatoire des données (le téléphone est-il requis ?), les mineurs. CGU et politique ne sont liées **que depuis le footer de la page d'accueil web** : ni l'inscription web ni l'app mobile ne les affichent ni ne demandent de les accepter.

**E4. Fuite d'adresses IP vers des tiers sans information** — images `images.unsplash.com` chargées depuis le navigateur/app des visiteurs (15 occurrences front-web), STUN Google (`STUN_SERVER_URL=stun:stun.l.google.com:19302`) qui reçoit l'IP des streamers. *À faire* : héberger les images en local ou via un proxy, mentionner Google STUN dans la politique, ou monter un serveur STUN/TURN maison.

**E5. Pas de limite d'âge ni de contrôle** — aucune date de naissance ni mention d'âge minimum dans l'inscription ni dans les CGU. Un service vidéo avec chat public attire des mineurs (< 15 ans en France : consentement parental). *À faire* : âge minimum dans les CGU + case de confirmation à l'inscription.

**E6. Sécurité des données (art. 32)** :
- Token en `localStorage` (front-web `lib/useAuth.ts`, analytics `lib/api.ts`) alors qu'un cookie httpOnly existe déjà : exposé en cas de XSS. Le cookie dure 30 j mais le JWT 7 j (`oauth_web.go:285` vs `auth.go:498`).
- JWT accepté en query string (`middleware/auth.go:20`), donc dans les logs, l'historique et les referrers.
- Codes de vérification et tokens de reset stockés **en clair** (`verification_code.go`, `password_reset.go`) : stocker un hash.
- `CORS: *` (`middleware/cors.go`) ; aucune limitation de débit sur login / register / resend-code / forgot-password.
- Postgres `sslmode=disable` (`db/db.go`) ; `docker-compose.yml` publie le port 5432 avec le mot de passe par défaut `root` ; le backend publie `8081` en clair (HTTPS seulement via le compose VM).
- `GET /api/scrape/marmiton` est **public** et vérifie l'URL avec `strings.Contains(url, "marmiton.org")` : contournable (`https://evil.test/?marmiton.org`) → SSRF vers le réseau interne.
- Photos uploadées servies telles quelles : les métadonnées EXIF (GPS) ne sont pas retirées (`upload/upload.go`).

### 🟡 Moyens

- **M1** Profil public : `UserDTO` ne montre que le nécessaire (bien), mais **prénom + nom réels** sont publics en plus du pseudo. Laisser l'utilisateur choisir ce qui est public.
- **M2** `GET /users/me` renvoie l'objet `User` complet incluant `banReason`, `googleId`… : acceptable pour soi, mais préférer un DTO dédié.
- **M3** Admin (`analytics`) : liste tous les emails, token en `localStorage`, pas de journal d'accès (qui a consulté / supprimé quoi). Ajouter un journal d'audit et limiter les champs affichés.
- **M4** Téléphone : stocké + `IsPhoneVerified` + type `sms` ; je n'ai pas vérifié le fournisseur SMS ni la base légale. Si non indispensable, ne pas le collecter.
- **M5** Raison de ban stockée indéfiniment : définir la durée et l'information de la personne bannie.
- **M6** `CookieConsentBanner` / `privacyConsent.ts` existent mais ne sont pas montés. Tant qu'aucun traceur non essentiel n'existe, la bannière n'est pas obligatoire ; en revanche **ne pas écrire « consentement » dans la politique sans la mettre en œuvre** si un traceur est ajouté un jour.
- **M7** Mobile : permissions caméra/micro/Bluetooth/réseau (cohérentes avec le service) — renseigner les fiches « confidentialité des données » App Store / Play Store avec la même liste que la politique.

### 🟢 Points positifs

- Mots de passe hachés avec bcrypt, génération aléatoire pour les comptes OAuth.
- Profil public minimal côté API (`UserDTO`), email/téléphone/OAuth masqués pour les autres.
- Réponse générique sur `forgot-password` (pas d'énumération de comptes), tentatives de code limitées à 5, codes à durée limitée (15 min), tokens de reset 30 min.
- Cookie de session `httpOnly`, `Secure` selon le contexte ; `state` OAuth vérifié.
- Aucun traceur tiers, aucune pub, aucun SDK d'analytics ; polices servies par `next/font` (auto-hébergées).
- Bannissement et suppression côté admin disponibles ; suppression de compte côté mobile avec confirmation.
- Pages CGU et confidentialité présentes et reliées.

---

## 3. Plan d'action proposé

| # | Action | Priorité | Effort |
|---|---|---|---|
| 1 | Nettoyer les logs : DEBUG OAuth, emails masqués, OTP hors dev, query string `token` masquée | 🔴 | 0,5 j |
| 2 | Service d'effacement complet d'un utilisateur (+ tests) et bouton sur web | 🔴 | 2 j |
| 3 | Endpoint + bouton d'export des données | 🔴 | 1,5 j |
| 4 | Job de purge (codes, tokens, activités, chats) + durées chiffrées | 🟠 | 1 j |
| 5 | Réécrire la politique de confidentialité (responsable, contact, durées, destinataires, transferts, CNIL, mineurs, live/replay) + lien à l'inscription web/mobile | 🟠 | 1 j (rédaction) |
| 6 | Information « live enregistré » + consentement co-streamers + option sans replay | 🟠 | 1,5 j |
| 7 | Retirer le JWT de la query string (ticket WebSocket court), supprimer le token du `localStorage`, aligner durées cookie/JWT | 🟠 | 1,5 j |
| 8 | Hash des codes/tokens, rate limiting, CORS restreint, SSRF du scrape, EXIF, Postgres TLS | 🟠 | 2 j |
| 9 | Héberger les images (Unsplash) et décider du STUN | 🟠 | 0,5 j |
| 10 | Âge minimum (CGU + case d'inscription) | 🟠 | 0,5 j |
| 11 | Registre des traitements (art. 30), analyse d'impact si diffusion vidéo à grande échelle, contrats sous-traitants (hébergeur, SMTP/SMS, Google), procédure de violation de données (72 h) | 🟡 | doc |
| 12 | Journal d'audit admin, choix de visibilité du nom/prénom | 🟡 | 1 j |

Les points 1, 2, 3 et 7 sont des changements de code indépendants et peuvent partir en PR séparées ; les points 5, 10 et 11 demandent une décision de l'équipe (contact, durées, âge) avant d'être écrits.
