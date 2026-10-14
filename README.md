# Foodstream (Etchebest)

Plateforme interactive de live streaming culinaire développée dans le cadre d'un Epitech Innovation Project (EIP).
Un streamer hôte peut animer un atelier culinaire interactif en direct et accueillir jusqu'à 5 co-streamers en visio temps réel (WebRTC). En parallèle, les spectateurs peuvent regarder la session sans limite d'audience grâce à la diffusion HLS générée via un pont FFmpeg en direct.

---

## Architecture globale

Le projet est structuré en plusieurs sous-projets :

- **`backend/`** : API REST, WebSocket, moteur WebRTC (Pion en Go) et transcodeur HLS (FFmpeg).
- **`front-web/`** : Application web Next.js pour le broadcast, le chat et le visionnage HLS.
- **`analytics/`** : Application web Next.js pour l'administration, la supervision et les métriques.
- **`mobile/`** : Application mobile Expo React Native avec WebRTC natif (`react-native-webrtc`).

```en
┌─────────────────────────────────────────────────────────────┐
│                    Clients Web / Mobile                     │
│  - Streamer (Hôte) & Co-streamers (jusqu'à 5) : WebRTC      │
│  - Viewers (Spectateurs illimités) : HLS                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
           WebRTC (UDP)        │        HTTP / WS
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend Foodstream (Go)                     │
│  - Pion WebRTC SFU / Media Engine (H.264 Baseline)          │
│  - Relais UDP interne vers FFmpeg                           │
│  - FFmpeg → Segments HLS (.m3u8 / .ts)                      │
│  - API REST & WebSocket (Renégociation, Auth, Chat, Rooms)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                     PostgreSQL 16 (Données)
```

---

## Démarrage rapide (développement)

Prérequis : Docker (Compose v2), Node 22 ; Go 1.25 pour lancer les tests du backend.

```bash
make dev
```

Cette seule commande :

1. crée `.env` depuis `.env.example` s'il n'existe pas (génère `JWT_SECRET`, active `DEV_MODE` pour afficher les codes de vérification) ;
2. règle `WEBRTC_IP` sur l'adresse IP de votre machine sur le réseau local ;
3. démarre PostgreSQL et le backend, et attend qu'ils soient prêts (`up --wait`) ;
4. lance Metro pour l'application mobile sur le port **8082** (le backend occupe le 8081).

L'application mobile trouve l'API toute seule à partir de l'adresse de Metro : plus rien à synchroniser quand vous changez de réseau.

| Commande | Rôle |
| :--- | :--- |
| `make dev` | Tout démarrer (backend + Metro) |
| `make up` / `make mobile` | Le backend seul / Metro seul |
| `make full` | Tout démarrer, y compris le front web (`:3000`) et l'analytics (`:3001`) |
| `make seed` | Créer 2 comptes de démo vérifiés (`demo.host@example.com`, `demo.viewer@example.com`, mot de passe `Demo1234!`) et un live planifié (nécessite `DEV_MODE=true`) |
| `make logs` | Suivre les logs du backend |
| `make restart` | Reconstruire et relancer le backend |
| `make down` | Arrêter les conteneurs (les données sont conservées) |
| `make reset` | **Tout supprimer** (base, replays, uploads) après confirmation |
| `make test` | Lancer tous les tests (backend, mobile, web, scripts) |
| `make help` | Lister toutes les commandes |

### Dépannage

- **« Port 8081 déjà utilisé »** : c'est souvent Metro lancé sur son port par défaut. Arrêtez-le et utilisez `make mobile` (port 8082).
- **« Erreur réseau » sur le téléphone** : vérifiez que le PC et le téléphone sont sur le même Wi-Fi, que `curl http://<IP du PC>:8081/api/lives` répond, puis le pare-feu. Sous Fedora : `sudo firewall-cmd --add-port=8081/tcp --add-port=50000-50100/udp` (ajoutez `--permanent` pour le conserver).
- **La caméra ne se connecte pas depuis un autre appareil** : `WEBRTC_IP` doit être l'IP du PC sur le réseau (`make setup` la met à jour ; relancez le backend avec `make restart`).
- **Émulateur Android** : l'application joint le PC via `10.0.2.2` automatiquement.
- **Code de vérification à l'inscription** : avec `DEV_MODE=true`, il est affiché dans les logs du backend (`make logs`) et l'application propose de le pré-remplir.
- **Replays et uploads** : ils sont dans le volume Docker `backend_data` et survivent aux reconstructions. Avant la toute première recréation du conteneur backend sur une installation plus ancienne, sauvegardez-les : `docker cp backend-foodstream:/foodstream/storage ./backup-storage`.

---

## Démarrage rapide avec Docker

L'ensemble de la stack (Base de données, Backend API, Frontend Web et Dashboard Analytics) démarre d'un coup :

```bash
# 1. Cloner le projet et se positionner à la racine
cd etchebest

# 2. Configurer les variables d'environnement (si besoin d'ajustement)
cp .env.example .env

# 3. Lancer l'ensemble des conteneurs
docker compose up -d --build
```

### Table des ports exposés

| Service | Port | Protocole | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `3000` | HTTP | Interface utilisateur web (`http://localhost:3000`) |
| **Analytics & Admin** | `3001` | HTTP | Dashboard d'administration (`http://localhost:3001`) |
| **Backend API** | `8081` | HTTP / WS | API REST, WebSocket, Swagger (`/api/swagger/index.html`) |
| **WebRTC Media** | `50000-50100` | UDP | Transport des paquets RTP audio/vidéo Pion |
| **PostgreSQL** | `5432` | TCP | Base de données relationnelle |

Pour arrêter les conteneurs :

```bash
docker compose down
```

---

## Configuration Réseau & WebRTC en Local / LAN

WebRTC nécessite que les clients puissent joindre le backend sur son adresse IP réelle.

### Pour tester depuis un navigateur sur la même machine

La valeur par défaut `WEBRTC_IP=127.0.0.1` dans `.env` fonctionne directement grâce au mapping des ports `50000-50100/udp` dans Docker Compose.

### Pour tester avec des téléphones ou d'autres machines sur le réseau local (LAN)

Lancez `make setup` (ou `./set-ip.sh`) : le script détecte votre adresse IP LAN (ex: `192.168.1.50`) et met à jour `WEBRTC_IP` dans `.env`. Une valeur choisie volontairement (IP publique, nom d'hôte) n'est jamais écrasée. Côté mobile, rien à configurer : l'application déduit l'adresse de l'API de celle de Metro.

---

## Application Mobile Expo

Pour le streaming vidéo WebRTC sur mobile :

- **Expo Go** ne supporte pas le WebRTC natif (`react-native-webrtc`).
- Un **development build natif** est nécessaire :

```bash
cd mobile
npm install

# Lancement sur Android
npx expo run:android

# Lancement sur iOS (sur macOS)
npx expo run:ios
```

---

## Tests & Simulation de charge

### Tests automatisés du Backend

```bash
cd backend
go test -v ./...
```

### Tests du Front Web

```bash
cd front-web
npm run build
```

### Tests unitaires Mobile

```bash
cd mobile
npm test -- --watchAll=false
```

### Simulation multi-clients & Capacité de room

Un script de test automatisé simule 5 participants en direct, teste le rejet au 6ème participant (saturation à 5/5), le départ d'un participant et la fermeture de room par l'hôte :

```bash
./scripts/simulate_room_capacity.sh
```

---

## Déploiement en Production (VM & Nom de domaine)

Pour déployer l'intégralité de la stack sur une machine virtuelle (AWS, GCP, OVH, etc.) avec nom de domaine (`foodstream.tv`), certificats SSL Let's Encrypt et reverse-proxy Nginx, consultez le guide dédié :
👉 **[DEPLOY_VM.md](./DEPLOY_VM.md)**docker compose -f docker-compose.vm.yml up -d --build