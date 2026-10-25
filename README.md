# Foodstream (Etchebest)

Plateforme de live streaming culinaire interactif, développée dans le cadre d'un
Epitech Innovation Project (EIP).

Un **hôte** anime un atelier de cuisine en direct et peut accueillir jusqu'à **5
co-streamers** en visio temps réel (WebRTC). Les **spectateurs**, sans limite de
nombre, regardent le direct en HLS, produit par FFmpeg à partir du flux WebRTC.
Chaque live peut être conservé en **replay**.

## Sommaire

1. [Architecture](#architecture)
2. [Démarrage rapide](#démarrage-rapide)
3. [Commandes](#commandes)
4. [Configuration (`.env`)](#configuration-env)
5. [Travailler sur chaque projet](#travailler-sur-chaque-projet)
6. [Tests, lint et CI](#tests-lint-et-ci)
7. [Conventions Git : branches, commits, PR](#conventions-git--branches-commits-pr)
8. [Dépannage](#dépannage)
9. [Déploiement](#déploiement)
10. [Documentation complémentaire](#documentation-complémentaire)

---

## Architecture

```text
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  front-web       │  │  mobile          │  │  analytics       │
│  Next.js 16      │  │  Expo SDK 57     │  │  Next.js 16      │
│  :3000           │  │  Metro :8082     │  │  :3001 (admin)   │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │  HTTP / WebSocket (API, chat, signalisation)  │
         │  WebRTC UDP (hôte + co-streamers)             │
         │  HLS (spectateurs, replays)                   │
         ▼                     ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│  backend (Go 1.25, Gin)                               :8081  │
│  - API REST + WebSocket, Swagger : /api/swagger/index.html   │
│  - SFU WebRTC (Pion) : un hôte, jusqu'à 5 co-streamers       │
│  - FFmpeg : WebRTC → HLS (.m3u8 / segments) et replays       │
│    échelle de qualité selon la source, plafond HLS_MAX_LIVES │
│  - Fichiers (replays, uploads) : volume Docker backend_data  │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
                 PostgreSQL 16 (volume postgres_data)
```

| Dossier | Rôle | Stack |
| :--- | :--- | :--- |
| `backend/` | API, signalisation WebRTC, SFU, HLS, replays, e-mails | Go 1.25, Gin, Pion WebRTC v4, GORM, FFmpeg |
| `front-web/` | Application web : accueil, lives, Studio, diffusion, replays, profil, boutique | Next.js 16, React 19, TypeScript, Tailwind, hls.js |
| `mobile/` | Application mobile : les mêmes parcours, WebRTC natif | Expo SDK 57, React Native 0.86, expo-router, react-native-webrtc |
| `analytics/` | Tableau de bord d'administration : utilisateurs, modération, statistiques | Next.js 16, React 19 |
| `scripts/` | Mise en place du dev, comptes de démo, test de capacité d'une room | Bash |
| `backlog/` | Génération des issues GitHub à partir des audits | Python |

Organisation du backend (`backend/internal/`) :

- `auth/` : inscription, connexion, codes de vérification, Google OAuth, session
  par cookie httpOnly ;
- `modules/` : un dossier par domaine (`room`, `live`, `chat`, `user`,
  `account`, `activity`, `audit`, `discover`, `search`, `tag`, `dish`,
  `country`, `scrape`, `upload`) ;
- `hls/` : pilotage de FFmpeg ;
- `notify/` : envoi des e-mails ;
- `middleware/`, `routes/`, `db/`, `httpx/`, `utils/` : le reste de la
  plomberie.

Le détail du live (signalisation, SFU, HLS, replays) est dans
[`TECHNICAL.md`](TECHNICAL.md).

---

## Démarrage rapide

### Prérequis

- Docker avec Compose v2, et `make` ;
- Node 22 (le CI l'utilise ; React Native demande au minimum 20.19.4) ;
- Go 1.25, seulement pour lancer les tests du backend hors Docker ;
- pour l'application mobile : Android Studio (SDK et émulateur) et JDK 17, ou un
  téléphone Android ; un Mac avec Xcode pour iOS.

```bash
git clone git@github.com:Foodstream-tv/etchebest.git
cd etchebest
make dev     # .env, Postgres + backend, puis Metro pour le mobile
make seed    # (autre terminal) comptes de démo et un live planifié
```

`make dev` :

1. crée `.env` depuis `.env.example` s'il n'existe pas (génère `JWT_SECRET`,
   active `DEV_MODE`) ;
2. règle `WEBRTC_IP` sur l'adresse de la machine sur le réseau local ;
3. démarre PostgreSQL et le backend et attend qu'ils soient prêts ;
4. lance Metro (application mobile) sur le port **8082**, le backend occupant
   le 8081.

Pour aussi lancer le web et l'analytics dans Docker : `make full`.

| Service | Adresse |
| :--- | :--- |
| API | <http://localhost:8081/api> |
| Swagger | <http://localhost:8081/api/swagger/index.html> |
| Front web (Docker) | <http://localhost:3000> |
| Analytics (Docker) | <http://localhost:3001> |
| Metro (mobile) | port 8082 |

**Comptes de démo** créés par `make seed` (mot de passe `Demo1234!`) :

- `demo.host@example.com` : un hôte avec un live planifié ;
- `demo.viewer@example.com` : un spectateur ou co-streamer.

Pour tester un live, connectez-vous avec l'hôte d'un côté et avec le spectateur
de l'autre (un autre navigateur, une fenêtre privée ou l'application mobile).

---

## Commandes

### Racine (`make help`)

| Commande | Rôle |
| :--- | :--- |
| `make dev` | Backend + Metro : toute la boucle de dev mobile |
| `make up` | Postgres + backend seuls, attend qu'ils soient prêts |
| `make full` | Tout dans Docker : Postgres, backend, web (:3000), analytics (:3001) |
| `make mobile` | Metro seul, port 8082 (`METRO_PORT=...` pour le changer) |
| `make setup` | (Re)crée `.env`, complète `DEV_MODE`, met à jour `WEBRTC_IP` et installe les hooks Git |
| `make hooks` | Installe seulement les hooks Git (`.githooks/`) |
| `make seed` | Comptes de démo vérifiés et un live planifié (nécessite `DEV_MODE=true`) |
| `make logs` | Suit les logs du backend |
| `make restart` | Reconstruit et relance le backend seul |
| `make ps` | Liste les conteneurs |
| `make down` | Arrête les conteneurs, les données sont conservées |
| `make reset` | **Supprime** la base, les replays et les uploads (confirmation demandée) |
| `make test` | Toutes les vérifications : backend, mobile, web, scripts |
| `make test-backend` / `test-mobile` / `test-web` / `test-scripts` | Une seule partie |

### Par projet

| Projet | Lancer | Vérifier |
| :--- | :--- | :--- |
| backend | `make up` (Docker), ou hors Docker : voir [Backend](#backend) | `go vet ./... && go test -race ./...` |
| front-web | `npm ci && npm run dev` | `npx tsc --noEmit && npm run lint` ; `npm run build` |
| mobile | `npx expo start --dev-client --port 8082` | `npx tsc --noEmit && npx expo lint && npx jest` |
| analytics | `npm ci && npm run dev` | `npm run lint` ; `npm run build` |

---

## Configuration (`.env`)

Un seul `.env` à la racine, lu par Docker Compose et par le backend. Il est
ignoré par Git ; partez de `.env.example`. Les variables les plus utiles :

| Variable | Rôle |
| :--- | :--- |
| `JWT_SECRET` | Secret des sessions. Généré par `make setup`. **Jamais commité.** |
| `DEV_MODE` | `true` en local : l'API renvoie les codes de vérification (inscription, renvoi de code) et les écrit dans les logs si aucun SMTP n'est configuré. `make setup` l'ajoute à un `.env` qui ne l'a pas, sans écraser une valeur existante. |
| `WEBRTC_IP` | Adresse que les clients WebRTC utilisent pour joindre le backend. `127.0.0.1` suffit pour un navigateur sur la même machine ; mettez l'IP LAN (`make setup`) pour un téléphone ou une autre machine. |
| `WEBRTC_PORT_MIN` / `WEBRTC_PORT_MAX` | Plage UDP du média WebRTC (50000-50100 par défaut ; 40000-40050 si Hyper-V ou Teams occupent la plage sous Windows). |
| `HLS_MAX_LIVES` / `HLS_FULL_LADDER_LIVES` | Nombre de lives encodés en HLS en même temps, et seuil à partir duquel un nouveau live n'a plus que 480p et 360p. |
| `SMTP_*` | Envoi réel des e-mails. Sans SMTP, le contenu est simulé dans les logs (en `DEV_MODE`). |
| `APP_URL` | URL du front web (liens des e-mails, retour de la connexion Google). |
| `ALLOWED_REDIRECT_ORIGINS` | Autres origines autorisées pour le retour Google (ex. `http://localhost:3002`). |
| `CORS_ALLOWED_ORIGINS` | Autres applications autorisées à appeler l'API avec le cookie de session (ex. l'analytics en production). En `DEV_MODE`, tout `localhost` est accepté. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Connexion Google (facultatif). |
| `PRIVACY_CONTACT_EMAIL` | Contact affiché dans la politique de confidentialité. |

Le front web n'a pas besoin de `.env` en local : il appelle `/api`, que Next
redirige vers `API_PROXY_TARGET` (`http://localhost:8081` par défaut). Le mobile
déduit l'adresse de l'API de celle de Metro.

---

## Travailler sur chaque projet

### Backend

- **Après une modification du backend**, `make restart` reconstruit l'image et
  relance le conteneur. Suivez les logs avec `make logs`.
- **Hors Docker** (itérations plus rapides, débogueur) : FFmpeg doit être
  installé pour le HLS. Le backend lit `../.env`, où `POSTGRES_HOST=postgres` ne
  vaut que dans Docker :

  ```bash
  docker compose up -d --wait postgres
  docker compose stop backend          # libère le port 8081
  cd backend && POSTGRES_HOST=localhost go run ./cmd/server
  ```

- **Swagger** est généré par [swag](https://github.com/swaggo/swag) depuis les
  commentaires `// @Summary`, `// @Router`… des handlers. Après avoir ajouté ou
  modifié une route :

  ```bash
  cd backend
  go run github.com/swaggo/swag/cmd/swag@v1.16.6 init -g cmd/server/main.go -o docs
  ```

  et commitez `backend/docs/`.

- **`go.mod` doit rester propre** : la CI lance `go mod tidy -diff`. Lancez
  `go mod tidy` après un ajout ou un retrait de dépendance.
- **Base de données** :
  `docker exec -it db-foodstream psql -U root -d foodstream`.
- **Compte admin** (pour l'analytics) : promouvez un compte existant :

  ```bash
  docker exec db-foodstream psql -U root -d foodstream \
    -c "UPDATE users SET role='ADMIN' WHERE email='demo.host@example.com';"
  ```

### Front web

- `npm run dev` démarre sur le port 3000, ou sur le suivant libre si le
  conteneur `frontend` tourne déjà (souvent **3002**, le 3001 étant pris par
  l'analytics). Testez vos changements sur ce port-là : le conteneur du 3000
  contient la version construite au dernier `make full`.
- Pour la connexion Google depuis ce port, ajoutez-le à
  `ALLOWED_REDIRECT_ORIGINS`.
- **Textes** : tout texte affiché passe par `t("clé")` et existe dans
  `src/i18n/messages/fr.ts` **et** `en.ts`.
- **Appels API** : passez par `apiFetch` (`src/lib/api.ts`) ou les services de
  `src/services/`. La session est un cookie httpOnly : aucun jeton n'est stocké
  dans le navigateur.
- **Effets React** : le lint applique les règles du React Compiler
  (`set-state-in-effect`, `preserve-manual-memoization`…). Préférez une valeur
  dérivée pendant le rendu, `useSyncExternalStore` pour lire `localStorage`, et
  le chargement dans l'effet avec un drapeau `ignore`. `usePolling`
  (`src/lib/usePolling.ts`) gère le premier chargement (`immediate`) et le
  changement de room (`key`).

### Application mobile

- **Development build obligatoire pour le live.** Expo Go ne contient ni
  `react-native-webrtc` ni Google Sign-In. Il suffit pour vérifier l'interface
  (`npx expo start --go`), mais pas pour diffuser, rejoindre un live ou se
  connecter avec Google.
- **Les dossiers `android/` et `ios/` ne sont pas commités** : ils sont générés
  depuis `app.json` (Continuous Native Generation). Tout réglage natif
  (permissions, textes iOS, plugins) va dans `app.json` ou dans un config
  plugin, jamais dans ces dossiers.
- **Régénérez-les** après un pull qui touche `app.json`, une dépendance native
  ou la version d'Expo, et après chaque montée de SDK :

  ```bash
  cd mobile
  npm ci
  npx expo prebuild --clean
  ```

- **Lancer sur un appareil :**

  ```bash
  npx expo run:android            # émulateur ou téléphone branché en USB
  npx expo run:ios                # macOS uniquement
  npx eas build --profile development --platform android|ios   # dev client dans le cloud
  ```

  Puis `npx expo start --dev-client --port 8082` (ou `make mobile`) et ouvrez
  l'application.

- **Identifiants** : `tv.foodstream.app` sur Android et iOS, projet EAS
  `etchebest` de l'organisation `foodstream-org`. La connexion Google dépend de
  ces identifiants : un client OAuth Android (identifiant + empreinte SHA-1 de
  la clé de signature, debug et EAS) et un client OAuth iOS (bundle ID) dans
  Google Cloud.
- **Navigation** : importez depuis `expo-router/react-navigation` et
  `expo-router/js-tabs`, pas depuis `@react-navigation/*`.
- **Lint** : 0 erreur ; les règles du React Compiler (`react-hooks/refs`,
  `set-state-in-effect`, `use-memo`) sont en avertissement le temps de corriger
  le code existant. N'en ajoutez pas de nouveaux.

### Analytics

Réservé aux comptes `ADMIN` (voir [Backend](#backend)). En local, `make full` le
lance sur le port 3001 ; `npm run dev` dans `analytics/` pour travailler dessus.
Il n'est pas encore vérifié par la CI.

---

## Tests, lint et CI

### Ce qui est vérifié

| Projet | Vérifications | En local | CI |
| :--- | :--- | :--- | :--- |
| backend | build, `go vet`, `gofmt`, `go mod tidy -diff`, tests avec `-race`, Swagger à jour | `make test-backend` | ✅ |
| mobile | types, lint, tests Jest, `expo install --check`, `expo-doctor` | `make test-mobile` | ✅ |
| front-web | types, lint, build | `make test-web` ; `npm run build` | ✅ |
| analytics | types, lint, build | `npx tsc --noEmit && npm run lint && npm run build` | ✅ |
| scripts | tests shell de `dev-setup.sh` et `seed.sh` | `make test-scripts` | ✅ |
| titre de PR | format Conventional Commits | — | ✅ |

**Tests backend avec Postgres.** Les tests qui exécutent du vrai SQL (effacement
et export de compte, journal d'audit…) sont **ignorés** sans
`TEST_DATABASE_DSN`. Pour les lancer en local, utilisez une base jetable, pas
celle de dev :

```bash
docker run --rm -d --name pg-test -p 5433:5432 \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test postgres:16-alpine
cd backend
TEST_DATABASE_DSN="host=localhost port=5433 user=postgres password=test dbname=test sslmode=disable" \
  go test -race ./...
docker stop pg-test
```

**Test de capacité d'une room.** `./scripts/simulate_room_capacity.sh` simule 5
participants, vérifie le refus du 6ᵉ, le départ d'un participant et la fermeture
par l'hôte (backend lancé).

### CI (GitHub Actions)

- **`CI - Build & Test`** (`.github/workflows/ci.yml`) tourne sur chaque PR et
  sur les push vers `main`, `dev` et `feature/*`. Il a cinq jobs : Backend,
  Mobile, Web, Analytics, Dev scripts. Un nouveau push annule le run en cours sur
  la même branche.
- **Swagger à jour** : le job Backend régénère `backend/docs` et échoue s'il
  diffère de la version commitée. Après avoir ajouté ou modifié une route,
  régénérez-le (voir [Backend](#backend)).
- **`PR title`** (`.github/workflows/pr-title.yml`) vérifie que le titre de la
  PR suit Conventional Commits (`type(périmètre): …`) : c'est lui qui devient le
  commit sur `main`.
- **CodeQL** analyse la sécurité du code (Go, JS/TS, Python, GitHub Actions) sur
  chaque PR et sur `main`, via la configuration par défaut de GitHub (Settings →
  Code security).
- **Secret scanning** avec push protection : un push qui contient une clé ou un
  mot de passe reconnu est bloqué avant d'arriver sur GitHub.
- **Dependabot** (`.github/dependabot.yml`) propose chaque semaine, par projet
  (Go, web, analytics, mobile, GitHub Actions), une PR pour les mises à jour
  mineures et correctives et une autre pour les majeures. Les premières sont
  **mergées automatiquement** quand la CI est verte
  (`dependabot-auto-merge.yml`) ; les majeures restent à relire. Côté mobile,
  Expo, React, React Native et ce que la SDK fixe (TypeScript, Jest, ESLint)
  sont exclus : ils montent avec la SDK, dans une PR dédiée
  (`npx expo install expo@^58 --fix`). Les alertes de sécurité arrivent toujours
  au fil de l'eau.

### Automatisations

| Workflow | Quand | Ce qu'il fait |
| :--- | :--- | :--- |
| `pr-triage.yml` | Ouverture et push d'une PR | Labels `area:*`, `documentation`, `dependencies` selon les fichiers touchés (`.github/labeler.yml`) ; assigne l'auteur |
| `dependabot-auto-merge.yml` | PR Dependabot | Active le merge automatique des mises à jour mineures et correctives |
| `stale.yml` | Chaque jour | Commentaire et label `inactif` après 30 jours sans activité ; ne ferme rien, ignore les issues de milestone et les P0/P1 |
| `weekly-report.yml` | Lundi matin, ou à la main | Publie le point de la semaine sur l'issue « Point hebdomadaire » (`scripts/weekly-report.sh --dry-run` pour le voir en local) |

---

## Conventions Git : branches, commits, PR

### Branches

Partez toujours de `main` à jour, une branche par sujet :

```text
feat/studio-wizard          nouvelle fonctionnalité
fix/web-lint                correction
chore/expo-sdk-57           maintenance, dépendances, outillage
refactor/…                  réorganisation sans changement de comportement
docs/…                      documentation
```

### Commits

Format [Conventional Commits](https://www.conventionalcommits.org/fr/), message
**en français**, à l'impératif ou au présent :

```text
type(périmètre): ce que fait le commit

Pourquoi ce changement, ce qui change pour l'utilisateur ou le dev,
ce qui a été vérifié. Une ligne vide entre le titre et le corps.
```

- **Types** : `feat`, `fix`, `refactor`, `perf`, `style` (formatage seul),
  `docs`, `test`, `chore`, `build` (dépendances), `ci`, `revert`.
- **Périmètres courants** : `web`, `mobile`, `live`, `backend`, `rgpd`,
  `security`, `dev`, `deps`.
- Exemples tirés de l'historique :
  - `fix(live): FFmpeg est supervisé, relancé après un crash et arrêté proprement`
  - `feat(rgpd): codes de vérification et tokens de reset stockés hachés`
- Un commit = un changement cohérent. Ne mélangez pas une correction et un
  reformatage massif.
- Ne commitez jamais `.env`, une clé, un mot de passe ni un fichier généré
  localement (`node_modules`, `mobile/android`, `mobile/ios`, `.next`…).

### Hooks Git

`make setup` (ou `make hooks`) configure Git pour utiliser `.githooks/` :

- **`commit-msg`** refuse un message qui ne suit pas le format ci-dessus ;
- **`pre-commit`** vérifie seulement les fichiers ajoutés au commit : `gofmt`
  pour le Go, ESLint pour `front-web`, `analytics` et `mobile` (les erreurs
  bloquent, pas les avertissements).

Ils attrapent en quelques secondes ce que la CI refuserait. Exceptionnellement,
`git commit --no-verify` passe outre.

### Pull requests

1. **Avant d'ouvrir** : `make test` (ou au moins le `make test-…` du projet
   touché) passe en local, la branche est à jour avec `main`.
2. **Titre** : au format d'un commit (`fix(web): …`). Il devient le message du
   commit sur `main`.
3. **Description**, en français :
   - **Pourquoi** : le problème ou le besoin, avec l'issue (`Refs #123`, ou
     `Closes #123` si la PR la termine) ;
   - **Changements** : ce qui change, fichier ou comportement ;
   - **Vérifié** : ce qui a été testé (commandes, navigateur, appareil
     Android/iOS) et ce qui **ne l'a pas** été ;
   - **À savoir** : migration, variable d'environnement à ajouter, action à
     faire après le merge (ex. `npx expo prebuild --clean`).
4. **CI verte obligatoire** avant le merge. Faites relire par au moins une autre
   personne quand la PR touche le live, l'authentification, les données
   personnelles ou les dépendances natives.
5. **Merge en « Squash and merge »** : un commit propre par PR sur `main`.
   Supprimez la branche ensuite.
6. Une PR = un sujet. Une PR plus petite est relue plus vite et plus
   sérieusement.

### Issues et tableau de suivi

- Le suivi se fait sur le projet GitHub
  **[Foodstream](https://github.com/orgs/Foodstream-tv/projects/2)**, avec les
  colonnes Backlog, In progress, In review et Done.
- **Une issue par tâche**, avec des critères d'acceptation. Quand vous la
  prenez, assignez-vous et passez-la en _In progress_. La PR la fait passer en
  _In review_, et le merge (avec `Closes #…`) en _Done_.
- La feuille de route technique est rangée par milestones (Phase 2 à 5, Qualité
  & tests), issues de `AUDIT_LIVE_WEBRTC.md` (voir `backlog/README.md`).

---

## Dépannage

| Symptôme | Cause et solution |
| :--- | :--- |
| **Port 8081 déjà utilisé** | Souvent Metro lancé sur son port par défaut. Arrêtez-le et utilisez `make mobile` (port 8082). |
| **« Erreur réseau » sur le téléphone** | Le PC et le téléphone doivent être sur le même Wi-Fi. Vérifiez que `curl http://<IP du PC>:8081/api/lives` répond, puis le pare-feu. Sous Fedora : `sudo firewall-cmd --add-port=8081/tcp --add-port=50000-50100/udp` (ajoutez `--permanent` pour le conserver). |
| **La caméra ne se connecte pas depuis un autre appareil** | `WEBRTC_IP` doit être l'IP du PC sur le réseau : `make setup`, puis `make restart`. |
| **Pas de code de vérification** | Vérifiez `DEV_MODE=true` dans `.env` (puis `make restart`). Avec `DEV_MODE`, la page de vérification affiche le code renvoyé par l'API ; si vous arrivez sur cette page depuis la connexion, cliquez sur « Renvoyer un code ». Si un SMTP est configuré, le code part aussi par e-mail. Sinon, utilisez les comptes de `make seed`. |
| **Mes changements web n'apparaissent pas** | Vous êtes sur le conteneur du port 3000, construit au dernier `make full`. Utilisez le port de `npm run dev` (souvent 3002). |
| **Expo Go : le live ou Google ne marchent pas** | Normal : il faut un development build (voir [Application mobile](#application-mobile)). |
| **Build natif en erreur après un pull ou une montée de SDK** | Dossiers natifs périmés : `npm ci && npx expo prebuild --clean` dans `mobile/`, puis réinstallez le dev client. |
| **`expo-doctor` signale des doublons de `react` / `react-native`** | Un `node_modules` traîne à la racine du dépôt (reste de l'ancienne app). Supprimez-le : `rm -rf node_modules` à la racine. |
| **L'émulateur Android se ferme au démarrage** | Problème de rendu graphique : lancez-le en rendu logiciel, `emulator @<nom_avd> -gpu swiftshader_indirect`, ou mettez l'émulateur à jour. |
| **Émulateur Android et API** | L'application joint le PC via `10.0.2.2` automatiquement. |
| **Replays et uploads** | Ils sont dans le volume Docker `backend_data` et survivent aux reconstructions ; `make reset` les supprime. |

---

## Déploiement

Sur une machine virtuelle avec nom de domaine (`foodstream.tv`), certificats
Let's Encrypt et reverse-proxy Nginx :

1. `./setup-ssl.sh` (une seule fois, sur la VM) génère les certificats ;
2. `docker compose -f docker-compose.vm.yml up -d --build` démarre la stack
   derrière Nginx (`nginx.conf`).

Avant une mise en production, vérifiez au minimum :

- `DEV_MODE=false` ;
- un `JWT_SECRET` propre à l'environnement ;
- un SMTP configuré ;
- `APP_URL`, `ALLOWED_REDIRECT_ORIGINS` et `CORS_ALLOWED_ORIGINS` (avec l'URL de
  l'analytics) pointant sur les vrais domaines ;
- `WEBRTC_IP` sur l'IP publique, et les ports UDP ouverts.

Les points encore ouverts sont suivis dans les issues #121, #227 et #287.

### Versions et builds mobiles

- **Releases** (`release-please.yml`) : à chaque merge sur `main`, une PR
  « chore(main): release x.y.z » tient à jour `CHANGELOG.md` à partir des titres
  de PR. La merger crée le tag `vX.Y.Z` et la release GitHub. `feat` augmente la
  version mineure, `fix` le correctif. Nécessite le secret
  `RELEASE_PLEASE_TOKEN` (token à grain fin, droits _contents_ et _pull
  requests_ en écriture) pour que la PR de release passe par la CI.
- **Builds EAS** (`eas-build.yml`) : build mobile sur les serveurs d'Expo, sans
  Mac pour iOS. Lancement à la main depuis l'onglet Actions (profil et
  plateforme au choix), et build Android `preview` automatique à chaque release.
  Les builds apparaissent dans le dashboard Expo (organisation `foodstream-org`,
  projet `etchebest`), avec leur commit : suivi et téléchargement s'y font.
  Nécessite le secret `EXPO_TOKEN`, un _robot token_ de l'organisation
  `foodstream-org` (pas un token personnel) ; pour iOS, un compte Apple Developer
  et ses identifiants configurés une fois avec `npx eas credentials`.
- **Profils** (`mobile/eas.json`) : `development` (dev client, APK), `preview`
  (APK à installer pour tester) et `production` (AAB pour le Play Store, non
  installable directement). Les numéros de build sont gérés par EAS
  (`appVersionSource: remote`).

---

## Documentation complémentaire

| Document | Contenu |
| :--- | :--- |
| [`TECHNICAL.md`](TECHNICAL.md) | Architecture détaillée du live : WebRTC, SFU, HLS, replays |
| [`USER_JOURNEY.md`](USER_JOURNEY.md) | Parcours utilisateur : spectateur, hôte, co-streamer |
| [`BETA_TEST_PLAN.md`](BETA_TEST_PLAN.md) | Plan de test de la bêta et fonctionnalités démontrées |
| [`AUDIT_LIVE_WEBRTC.md`](AUDIT_LIVE_WEBRTC.md) | Audit du live, source des milestones Phase 2 à 5 |
| [`AUDIT_RGPD.md`](AUDIT_RGPD.md) / [`RGPD_RECAP.md`](RGPD_RECAP.md) | Audit RGPD et état d'avancement |
| [`backlog/README.md`](backlog/README.md) | Génération des issues à partir des audits |
| Swagger | <http://localhost:8081/api/swagger/index.html> (API lancée) |
