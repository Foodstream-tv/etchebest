# Foodstream — Parcours Utilisateur

## Vue d'ensemble

Foodstream est une application mobile de **live streaming culinaire** permettant à des utilisateurs de diffuser en direct leurs sessions de cuisine, de rejoindre des lives en co-stream, ou de regarder en tant que spectateur.

---

## 1. Onboarding

### 1.1 Inscription (`/register`)

```text
[Écran d'accueil]
       │
       ▼
[Formulaire d'inscription]
  ├─ Prénom / Nom
  ├─ Adresse e-mail
  ├─ Mot de passe (min. 8 caractères, maj + chiffre + spécial)
  ├─ Numéro de téléphone (sélecteur de pays 🇫🇷🇧🇪🇺🇸…)
  └─ [Bouton "S'inscrire"]
       │
       ├─ ✅ Succès → redirection vers l'écran principal (tabs)
       └─ ❌ Erreur → toast d'erreur (email déjà utilisé, validation…)
```

**Validations côté client :**

- Email : format valide
- Mot de passe : longueur, majuscule, chiffre, caractère spécial
- Prénom / Nom : 2 caractères minimum
- Téléphone : 7–15 chiffres selon l'indicatif pays

---

### 1.2 Connexion (`/login`)

```text
[Écran de connexion]
  ├─ Email
  ├─ Mot de passe
  ├─ [Mot de passe oublié ?]
  └─ [Bouton "Se connecter"]
       │
       ├─ ✅ Succès → token JWT sauvegardé → redirection (tabs)
       └─ ❌ Erreur → toast d'erreur
```

---

### 1.3 Mot de passe oublié (`/forgot-password`)

```text
[Saisie de l'email]
       │
       ▼
[Confirmation] — "Si un compte existe, un lien a été envoyé."
```

> ⚠️ Fonctionnalité UI uniquement (pas encore de backend d'envoi d'email).

---

## 2. Navigation principale (Tabs)

Une fois connecté, l'utilisateur accède à 5 onglets :

| Onglet | Écran | Description |
| ------ | ----- | ----------- |
| 🏠 Home | `(tabs)/index` | Page d'accueil (placeholder) |
| 🔍 Discover | `(tabs)/discover` | Découverte des lives et catégories |
| ➕ Créer | `(tabs)/add` | Création / configuration d'un live |
| ❤️ Favoris | `(tabs)/favoris` | Lives favoris |
| 👤 Profil | `(tabs)/profil` | Profil utilisateur |

---

## 3. Parcours Spectateur

### Objectif : regarder un live en cours

```text
[Onglet Discover]
       │
       ├─ Catégories (Asiatique, Pâtisserie, BBQ…)
       ├─ Lives en vedette
       └─ [Tap sur un live]
              │
              ▼
       [Onglet ou bouton "Voir les lives"]
              │
              ▼
       [Liste des rooms actives — /live-rooms]
         ┌─────────────────────────────┐
         │ 🔴 Nom du live              │
         │ 👥 2/5 streamers            │
         │ 👁 42 spectateurs           │
         │                             │
         │ [▶ Regarder]  [📹 Rejoindre]│
         └─────────────────────────────┘
              │
              │ Tap "Regarder"
              ▼
       [Écran Viewer — /live-viewer]
         • Lecture HLS via expo-av (natif) ou hls.js (web)
         • Polling m3u8 toutes les ~2s
         • Plein écran disponible
```

**Flux réseau spectateur :**

1. `GET /api/rooms` → liste des rooms
2. `GET /api/hls/{roomId}/index.m3u8` → playlist HLS
3. `GET /api/hls/{roomId}/index{N}.ts` → segments vidéo (polling)

---

## 4. Parcours Streamer (Host)

### Objectif : créer et diffuser son propre live

```text
[Onglet "Créer" — (tabs)/add]
  ├─ Titre du live
  ├─ Description
  ├─ Type de cuisine (pills : Asiatique, BBQ, Végétarien…)
  ├─ Niveau (Débutant / Intermédiaire / Avancé)
  ├─ Durée estimée (30 / 45 / 60 / 90 min)
  ├─ Visibilité (Public / Non listé / Privé)
  ├─ Options chat (Chat activé / Slow mode / Abonnés seulement)
  │
  └─ [🎙 Lancer le live]
         │
         ▼
  [Écran Streaming — /live-streaming?mode=host]
    │
    ├─ Caméra locale affichée (RTCView natif / <video> web)
    ├─ Badge statut : Connexion… → 🔴 LIVE
    │
    └─ [Bouton "Lancer le live"]
           │
           ▼
    [WebRTC établi]
      1. POST /api/rooms          → création de la room
      2. POST /api/webrtc         → échange SDP (offer/answer)
      3. POST /api/ice            → candidats ICE
      4. Connexion établie ✅
      5. Backend → FFmpeg → HLS  (spectateurs peuvent regarder)
      │
      └─ [Bouton "Arrêter"]
             │
             ▼
      POST /api/rooms/:roomId/disconnect
      → Retour à l'écran précédent
```

---

## 5. Parcours Co-Streamer

### Objectif : rejoindre un live existant en tant que participant

```text
[Liste des rooms — /live-rooms]
       │
       │ Tap "📹 Rejoindre" (si places disponibles)
       ▼
[Écran Streaming — /live-streaming?mode=join&roomId=...]
  │
  ├─ Caméra locale (propre flux)
  ├─ Flux distants des autres co-streamers (grille)
  │
  └─ [Flux WebRTC]
      1. POST /api/rooms/:roomId/reserve  → réservation de place
      2. POST /api/webrtc                 → échange SDP
      3. POST /api/ice                    → candidats ICE
      4. OnTrack → réception flux host
      5. Relay → flux envoyé aux autres viewers

  [Bouton "Arrêter"] → disconnect + retour
```

**Limite :** `maxParticipants = 10` par room (auto-ajout si place disponible).

---

## 6. Parcours Profil & Paramètres

```text
[Onglet Profil — (tabs)/profil]
       │
       └─ [Paramètres — /settings]
              ├─ Informations personnelles (nom, email, téléphone)
              ├─ Préférences culinaires
              ├─ Notifications
              ├─ Confidentialité
              └─ [Se déconnecter] → suppression token JWT → /login
```

---

## 7. Schéma global des écrans

```text
/login ────────────────────────────────────┐
/register ─────────────────────────────────│
/forgot-password                           │
                                           ▼
                                ┌──────────────────┐
                                │   (tabs)         │
                                │  ┌────────────┐  │
                                │  │   Home     │  │
                                │  │  Discover  │──┼──▶ /live-rooms ──▶ /live-viewer
                                │  │  Créer     │──┼──▶ /live-streaming (host)
                                │  │  Favoris   │  │
                                │  │  Profil    │──┼──▶ /settings
                                │  └────────────┘  │
                                └──────────────────┘
                                           │
                                /live-rooms (liste)
                                    ├──▶ /live-viewer       (spectateur HLS)
                                    └──▶ /live-streaming    (co-streamer WebRTC)
```

---

## 8. Cas d'erreur notables

| Situation | Comportement |
| --------- | ------------ |
| Room pleine (`maxParticipants` atteint) | Toast "room is full", bouton "Rejoindre" grisé |
| Pas de réseau | Toast d'erreur, bouton "Réessayer" affiché |
| Token JWT expiré | Redirection automatique vers `/login` |
| Room inexistante | 404 → retour à la liste |
| Déconnexion WebRTC inattendue | Nettoyage automatique (`OnConnectionStateChange`) |

---

## 9. Stack technique résumée

| Couche | Technologie |
| ------ | ----------- |
| Mobile | React Native (Expo) |
| Web | Next.js |
| Backend | Go (Gin) + PostgreSQL |
| Temps réel | WebRTC (Pion) — SFU maison |
| Diffusion HLS | FFmpeg (Docker) |
| Auth | JWT (Bearer token) |
