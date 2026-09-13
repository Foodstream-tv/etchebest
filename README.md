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

```
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

### Pour tester depuis un navigateur sur la même machine :
La valeur par défaut `WEBRTC_IP=127.0.0.1` dans `.env` fonctionne directement grâce au mapping des ports `50000-50100/udp` dans Docker Compose.

### Pour tester avec des téléphones ou d'autres machines sur le réseau local (LAN) :
Exécutez le script d'auto-détection IP :
```bash
./set-ip.sh
```
Ce script détecte automatiquement votre adresse IP LAN (ex: `192.168.1.50`) et met à jour `WEBRTC_IP` dans `.env` ainsi que `mobile/.env`.

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

### Tests automatisés du Backend :
```bash
cd backend
go test -v ./...
```

### Tests du Front Web :
```bash
cd front-web
npm run build
```

### Tests unitaires Mobile :
```bash
cd mobile
npm test -- --watchAll=false
```

### Simulation multi-clients & Capacité de room :
Un script de test automatisé simule 5 participants en direct, teste le rejet au 6ème participant (saturation à 5/5), le départ d'un participant et la fermeture de room par l'hôte :
```bash
./scripts/simulate_room_capacity.sh
```

---

## Déploiement en Production (VM & Nom de domaine)

Pour déployer l'intégralité de la stack sur une machine virtuelle (AWS, GCP, OVH, etc.) avec nom de domaine (`foodstream.tv`), certificats SSL Let's Encrypt et reverse-proxy Nginx, consultez le guide dédié :
👉 **[DEPLOY_VM.md](./DEPLOY_VM.md)**


