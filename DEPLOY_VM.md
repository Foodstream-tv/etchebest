# 🚀 Guide de Déploiement sur VM — Foodstream (foodstream.tv)

Ce guide contient **toutes les étapes et commandes nécessaires** pour déployer l'intégralité de la plateforme Foodstream sur une machine virtuelle (AWS EC2, GCP Compute Engine, OVH, Hetzner, DigitalOcean, etc.).

---

## 📋 Table des matières
1. [Pré-requis & Configuration externe](#1-pré-requis--configuration-externe)
   - [A. Zone DNS](#a-zone-dns-chez-votre-registrar)
   - [B. Pare-feu & Security Groups](#b-pare-feu--security-groups)
   - [C. Console Google Cloud OAuth](#c-console-google-cloud-oauth)
2. [Préparation de la VM (Installation des outils)](#2-préparation-de-la-vm)
3. [Génération des certificats SSL (HTTPS)](#3-génération-des-certificats-ssl-https)
4. [Configuration des variables d'environnement (`.env`)](#4-configuration-du-fichier-env)
5. [Démarrage de la stack Docker](#5-démarrage-de-la-stack-docker)
6. [Commandes de maintenance utiles](#6-commandes-de-maintenance-utiles)
7. [Dépannage & Diagnostic (FAQ)](#7-dépannage--diagnostic-faq)

---

## 1. Pré-requis & Configuration externe

### A. Zone DNS (chez votre registrar : OVH, Gandi, Cloudflare, etc.)
Ajoutez ou mettez à jour les enregistrements DNS de type **A** pour pointer vers l'**adresse IP publique de votre VM** :

| Type | Nom d'hôte / Sous-domaine | Valeur / Cible | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (ou `foodstream.tv`) | `<IP_PUBLIQUE_DE_LA_VM>` | 300 |
| **A** | `www` | `<IP_PUBLIQUE_DE_LA_VM>` | 300 |
| **A** | `analytics` | `<IP_PUBLIQUE_DE_LA_VM>` | 300 |

*(Attendez 5 à 15 minutes la propagation DNS avant de générer les certificats SSL).*

---

### B. Pare-feu & Security Groups
Sur l'interface de votre hébergeur cloud (et dans `ufw` sur la VM), ouvrez impérativement les flux suivants en entrée (*Inbound*) :

| Port | Protocole | Utilité | Source autorisée |
| :--- | :--- | :--- | :--- |
| **22** | **TCP** | Accès SSH à la VM | Votre IP perso |
| **80** | **TCP** | Nginx HTTP (redirection HTTPS & Certbot) | `0.0.0.0/0` (Tous) |
| **443** | **TCP** | Nginx HTTPS (Site web, API, Analytics) | `0.0.0.0/0` (Tous) |
| **50000 à 50100** | **UDP** | **Pion WebRTC (Flux vidéo & audio live)** | `0.0.0.0/0` (Tous) |

> [!CAUTION]
> **Ne JAMAIS ouvrir le port 5432 (PostgreSQL) sur Internet.** Il doit rester strictement interne à la machine.

---

### C. Console Google Cloud OAuth
Sur **[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)**, ouvrez votre client OAuth Web et ajoutez :

1. **Origines JavaScript autorisées** :
   - `https://foodstream.tv`
   - `https://analytics.foodstream.tv`
   - `http://localhost:3000` *(pour continuer à pouvoir tester en local)*

2. **URI de redirection autorisés** :
   - `https://foodstream.tv/api/auth/google/callback`
   - `http://localhost:8081/api/auth/google/callback` *(pour le local)*

---

## 2. Préparation de la VM

Connectez-vous en SSH à votre VM :
```bash
ssh <utilisateur>@<IP_DE_LA_VM>
```

### A. Mettre à jour le système et installer Git + Docker
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates gnupg certbot

# Installer Docker officiel
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Autoriser votre utilisateur à utiliser Docker sans sudo
sudo usermod -aG docker $USER
newgrp docker
```

### B. Configurer le pare-feu local (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 50000:50100/udp
sudo ufw --force enable
```

### C. Cloner le projet
```bash
cd ~
git clone https://github.com/Foodstream-io/etchebest.git
cd etchebest
```

---

## 3. Génération des certificats SSL (HTTPS)

WebRTC exige un contexte sécurisé (`https://`) sur les navigateurs web pour autoriser l'accès à la webcam et au microphone.

Exécutez Certbot en mode standalone (assurez-vous qu'aucun serveur web ne tourne sur le port 80 à ce moment) :
```bash
sudo certbot certonly --standalone \
  -d foodstream.tv \
  -d www.foodstream.tv \
  -d analytics.foodstream.tv \
  --email votre-email@domaine.com \
  --agree-tos --no-eff-email
```

> [!NOTE]
> Les certificats sont créés dans `/etc/letsencrypt/live/foodstream.tv/`.
> Le fichier `nginx.conf` et `docker-compose.vm.yml` sont déjà configurés pour monter directement ce dossier en lecture seule.

---

## 4. Configuration du fichier `.env`

Créez le fichier `.env` sur la VM :
```bash
nano .env
```

Copiez et adaptez la configuration suivante :

```env
# --- Base de données PostgreSQL ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=foodstream_user
POSTGRES_PASSWORD=DEFINIR_UN_MOT_DE_PASSE_TRES_ROBUSTE_ICI
POSTGRES_DB=foodstream

# --- Backend & Sécurité ---
BACKEND_PORT=8081
JWT_SECRET=GENERER_UNE_CLE_SECRETE_ALEATOIRE_DE_64_CARACTERES
STUN_SERVER_URL=stun:stun.l.google.com:19302

# --- WebRTC (Mettre impérativement l'IP publique de la VM) ---
WEBRTC_IP=METTRE_L_IP_PUBLIQUE_DE_LA_VM
WEBRTC_PORT_MIN=50000
WEBRTC_PORT_MAX=50100

# --- Domaines & Reverse Proxy ---
VM_IP=foodstream.tv
CORS_ALLOWED_ORIGINS=https://foodstream.tv,https://analytics.foodstream.tv

# --- Google OAuth Web ---
GOOGLE_CLIENT_ID=votre_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre_client_secret
GOOGLE_REDIRECT_URI=https://foodstream.tv/api/auth/google/callback
```

Sauvegardez avec `Ctrl + O` puis quittez avec `Ctrl + X`.

---

## 5. Démarrage de la stack Docker

Sur la VM, utilisez **exclusivement** le fichier `docker-compose.vm.yml` qui inclut le reverse-proxy Nginx avec terminaison SSL :

```bash
docker compose -f docker-compose.vm.yml up -d --build
```

Vérifiez que tous les conteneurs sont en statut `Up` ou `Healthy` :
```bash
docker compose -f docker-compose.vm.yml ps
```

Vous devez voir 5 services actifs :
1. `nginx-https` *(Reverse proxy SSL routant 80 et 443)*
2. `db-foodstream` *(PostgreSQL 16)*
3. `backend-foodstream` *(Go + Pion WebRTC)*
4. `frontend-foodstream` *(Next.js)*
5. `analytics-foodstream` *(Dashboard Analytics)*

---

## 6. Commandes de maintenance utiles

### Voir les logs en direct
```bash
# Logs du backend (WebRTC, ICE candidates, requêtes API)
docker compose -f docker-compose.vm.yml logs -f backend

# Logs de Nginx (requêtes entrantes, erreurs SSL)
docker compose -f docker-compose.vm.yml logs -f nginx

# Tous les logs
docker compose -f docker-compose.vm.yml logs -f
```

### Mettre à jour l'application lors d'un nouveau commit
```bash
git pull origin main
docker compose -f docker-compose.vm.yml up -d --build
```

### Redémarrer un service spécifique
```bash
docker compose -f docker-compose.vm.yml restart backend
```

### Éteindre l'ensemble des conteneurs
```bash
docker compose -f docker-compose.vm.yml down
```

### Renouvellement automatique du certificat Let's Encrypt
Ajoutez une tâche cron pour renouveler automatiquement les certificats avant expiration :
```bash
sudo crontab -e
```
Ajoutez cette ligne tout en bas (tous les lundis à 3h du matin) :
```cron
0 3 * * 1 certbot renew --quiet && docker compose -f /home/ubuntu/etchebest/docker-compose.vm.yml exec -T nginx nginx -s reload
```
*(Adaptez `/home/ubuntu/etchebest/` selon le chemin réel sur la VM).*

---

## 7. Dépannage & Diagnostic (FAQ)

### 🔴 "La vidéo ne s'affiche pas / échec ICE connection"
1. Vérifiez que `WEBRTC_IP` dans `.env` correspond bien à l'**IP publique** de la VM (pas `127.0.0.1`, pas une IP privée en `10.x` ou `172.x`).
2. Vérifiez que la plage UDP `50000-50100` est bien ouverte dans le pare-feu externe de votre hébergeur (Security Groups AWS/GCP, pare-feu OVH).

### 🔴 "Erreur Google OAuth : redirect_uri_mismatch"
Vérifiez que l'URL renseignée dans Google Cloud Console est strictement identique à `GOOGLE_REDIRECT_URI` dans `.env` :
`https://foodstream.tv/api/auth/google/callback` *(attention au https:// et aux slashes)*.

### 🔴 "502 Bad Gateway sur Nginx"
Vérifiez si le backend ou le frontend a crashé :
```bash
docker compose -f docker-compose.vm.yml ps
docker compose -f docker-compose.vm.yml logs backend
docker compose -f docker-compose.vm.yml logs frontend
```
