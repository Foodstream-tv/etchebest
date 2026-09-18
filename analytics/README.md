# Foodstream Analytics & Admin Dashboard

Ce sous-projet est une application Next.js dédiée au dashboard d'administration et de supervision pour la plateforme Foodstream.

## Responsabilités
- **Supervision des Lives & Rooms** : Visualisation en temps réel des rooms actives, du nombre de participants et de spectateurs.
- **Gestion des Utilisateurs & Modération** : Consultation des utilisateurs inscrits, bannissement temporaire ou permanent, réactivation de comptes.
- **Statistiques & Métriques** : Suivi des métriques clés (utilisateurs inscrits, streams hébergés, volume de vues).

## Contrat d'API & Données
L'application consomme directement les endpoints du backend Foodstream :
- `POST /api/login` : Authentification de l'administrateur.
- `GET /api/admin/users` : Liste complète des utilisateurs.
- `POST /api/admin/users/:id/ban` : Bannissement d'un utilisateur.
- `POST /api/admin/users/:id/unban` : Levée du ban.
- `GET /api/rooms` : Liste des rooms en direct.

## Variables d'environnement
- `NEXT_PUBLIC_API_URL` : URL de base du backend API (par défaut `http://localhost:8081`).
- `PORT` : Port du serveur web local (par défaut `3001` lorsqu'exécuté via Docker Compose).

## Lancement
- **Via Docker Compose** : Le service démarre automatiquement sur le port 3001 (`http://localhost:3001`).
- **En local** :
  ```bash
  cd analytics
  npm install
  npm run dev
  ```

