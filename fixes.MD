# Rapport d'état des lieux

## Objectif

Ce fichier sert de handoff pour un autre LLM de code.
Il doit permettre de comprendre l'état réel du projet, ce qui fonctionne déjà, ce qui est fragile, ce qui est dupliqué, ce qui est mort, et ce qui doit être corrigé en priorité.

## Synthèse courte

Le projet n'est plus un prototype simple. Le backend Go couvre déjà l'auth, les rooms, le chat, le signaling WebRTC, le bridge FFmpeg vers HLS, les replays, l'admin et plusieurs surfaces métier additionnelles.
Le front web expose des parcours broadcast et watch réalistes.
Le mobile Expo a une vraie implémentation live native, mais elle reste séparée du web et impose des contraintes de build natif.
Un sous-projet analytics a maintenant sa propre existence et est branché dans la cible VM.

Le problème principal reste structurel:

- état live trop dépendant de la mémoire du processus backend
- divergence persistante entre les clients web et mobile
- topologie Docker encore inadaptée à un WebRTC fiable sans préciser le transport UDP
- surface auth encore trop exposée côté client web
- code mort, doublons et dépendances déclarées sans usage clair

## État réel par zone

### Backend Candidates

Le backend reste la pièce la plus critique et la plus chargée fonctionnellement.

Ce qui est déjà en place:

- auth email/password
- auth Google web et mobile
- healthcheck racine et Swagger public
- CRUD et cycle de vie des rooms
- ajout / réservation / déconnexion de participants
- chat par room
- signaling WebRTC par REST
- renégociation via WebSocket et polling
- bridge RTP vers FFmpeg puis HLS multi-renditions
- génération de replay à partir du dossier local HLS
- routes discover, search, upload, scrape, lives et activités
- endpoints admin avec gestion des utilisateurs et modération du chat

Les fichiers centraux sont:

- [backend/cmd/server/main.go](backend/cmd/server/main.go)
- [backend/internal/routes/routes.go](backend/internal/routes/routes.go)
- [backend/internal/modules/room/room.go](backend/internal/modules/room/room.go)
- [backend/internal/modules/room/websocket.go](backend/internal/modules/room/websocket.go)
- [backend/internal/hls/streamer.go](backend/internal/hls/streamer.go)
- [backend/internal/hls/manager.go](backend/internal/hls/manager.go)
- [backend/internal/hls/replay.go](backend/internal/hls/replay.go)
- [backend/internal/auth/auth.go](backend/internal/auth/auth.go)
- [backend/internal/auth/oauth_web.go](backend/internal/auth/oauth_web.go)
- [backend/internal/auth/oauth_mobile.go](backend/internal/auth/oauth_mobile.go)

Ce qui est fragile:

- l'état live repose encore sur des maps et des objets de processus
- le backend reste mono-instance pour la logique temps réel
- les PeerConnection et les connexions WebSocket ne sont pas externalisées
- le cleanup dépend fortement du cycle de vie du process
- la renégociation mélange WebSocket et polling, ce qui augmente la surface de race conditions
- la route WebSocket garde une politique d'origine permissive
- la capacité des rooms n'est pas homogène: le modèle annonce `maxParticipants` à 5, mais un chemin de création initialise encore une room à 6, ce qui rend la limite difficile à valider de façon fiable

### Front web Candidates

Le front web est le client le plus abouti côté UX et parcours métier.

Les parcours principaux sont réels:

- [front-web/src/app/(app)/broadcast/[roomId]/page.tsx](front-web/src/app/(app)/broadcast/[roomId]/page.tsx)
- [front-web/src/app/(app)/watch/[roomId]/page.tsx](front-web/src/app/(app)/watch/[roomId]/page.tsx)
- [front-web/src/app/layout.tsx](front-web/src/app/layout.tsx)
- [front-web/src/app/(app)/layout.tsx](front-web/src/app/(app)/layout.tsx)
- [front-web/src/hooks/useWebRTC.ts](front-web/src/hooks/useWebRTC.ts)
- [front-web/src/services/streaming.ts](front-web/src/services/streaming.ts)

Ce qui est bon:

- broadcast et watch sont de vrais écrans applicatifs, pas du squelette
- le watch gère HLS, fallback, retry et sélection de qualité
- le broadcast agrège chat, statut live, preview vidéo et assistant de cuisine
- la logique WebRTC est spécifique au web et ne dépend pas d'un SDK générique inutilement

Ce qui doit être revu:

- [front-web/src/lib/webrtc/useRoomWebRTC.ts](front-web/src/lib/webrtc/useRoomWebRTC.ts) semble être un doublon ou un résidu à confirmer
- [front-web/src/lib/useAuth.ts](front-web/src/lib/useAuth.ts) stocke encore le token dans localStorage, sessionStorage et un cookie JS-accessible
- les dépendances LiveKit restent déclarées dans [front-web/package.json](front-web/package.json) alors que l'implémentation visible n'en dépend pas
- la surface d'auth web reste exposée à XSS via stockage côté navigateur

### Mobile Expo

Le mobile est fonctionnel, mais il suit une architecture distincte de celle du web.

Les vrais points d'entrée sont:

- [mobile/app/live-streaming.tsx](mobile/app/live-streaming.tsx)
- [mobile/app/live-viewer.tsx](mobile/app/live-viewer.tsx)
- [mobile/app/live-rooms.tsx](mobile/app/live-rooms.tsx)
- [mobile/hooks/useWebRTC.ts](mobile/hooks/useWebRTC.ts)
- [mobile/services/streaming.ts](mobile/services/streaming.ts)
- [mobile/components/HLSPlayer.tsx](mobile/components/HLSPlayer.tsx)
- [mobile/components/StreamView.native.tsx](mobile/components/StreamView.native.tsx)

Ce qui est important:

- Expo Go ne suffit pas pour la partie WebRTC native
- un development build natif est requis pour la visio
- la pile mobile a sa propre gestion d'auth, de streaming et de fallback
- la logique mobile inclut désormais du polling de renégociation régulier et une vue debug plus explicite

Ce qui doit être revu:

- la logique WebRTC mobile a divergé de la logique web
- les contrats d'appel backend devraient être harmonisés entre les deux clients
- la différence de stockage auth entre web et mobile est acceptable, mais elle doit être explicitement documentée
- le comportement en arrière-plan, en perte de réseau et au retour foreground n'est pas visiblement traité au niveau lifecycle

### Analytics

Un sous-projet analytics existe maintenant dans [analytics/package.json](analytics/package.json) et est déployé avec la VM.

Ce que l'on sait:

- c'est un app Next séparée
- elle a sa propre image Docker
- elle tourne sur le host network dans [docker-compose.vm.yml](docker-compose.vm.yml)

Ce qu'il faut encore clarifier:

- sa responsabilité produit exacte
- ses sources de données
- son mode d'accès
- sa place réelle dans le modèle de déploiement

Tant que ce périmètre n'est pas documenté, il faut considérer analytics comme une surface fonctionnelle à part entière, pas comme un simple ajout cosmétique.

### Infra et Docker

Le point faible le plus critique reste l'infrastructure.

Observations:

- [docker-compose.yml](docker-compose.yml) reste basé sur un réseau bridge classique
- [docker-compose.vm.yml](docker-compose.vm.yml) passe en host network pour nginx, backend, frontend et analytics
- le backend WebRTC dépend de STUN et de ports UDP accessibles
- le backend annonce des candidats ICE et utilise une IP WebRTC configurable via `WEBRTC_IP`
- [nginx.conf](nginx.conf) reverse-proxy le frontend et le backend derrière HTTPS

Risque principal:

- le WebRTC ne peut pas être considéré comme fiable si la topologie Docker n'est pas alignée avec les besoins UDP et avec l'adresse réellement annoncée aux clients

Conclusion infra:

- la cible VM ressemble davantage à la vraie architecture de déploiement
- la version compose standard n'est pas encore au même niveau de réalisme
- il faut soit exposer correctement les ports et la plage UDP, soit documenter un mode d'exécution host network pour les environnements WebRTC

### Racine du repo

Le repo contient maintenant plusieurs sous-projets bien distincts:

- front-web
- mobile
- backend
- analytics
- app

Le dossier racine [app/index.tsx](app/index.tsx) reste un squelette Hello World.
Il n'est probablement pas la vraie application de production.
Il doit être supprimé ou assumé explicitement.

## Dette fonctionnelle réelle

### 1. État backend trop local

Les rooms, connexions, offers et websockets reposent sur l'état mémoire du processus.
Conséquence:

- un redémarrage perd l'état live
- une deuxième instance backend ne partage pas l'état
- le failover n'est pas géré

### 2. Sécurité auth à renforcer

Points sensibles:

- OAuth web avec transport du JWT dans le flux de callback
- token côté JS dans le front web
- cookies et stockage local côté navigateur
- stockage natif mobile plus sûr mais différent

Le système fonctionne, mais la frontière de sécurité n'est pas propre.
Il faut choisir un modèle de session explicite pour le web et arrêter de laisser plusieurs mécanismes coexister sans contrat clair.

### 3. WebRTC et renégociation complexes

Le backend gère:

- ICE
- buffering des ICE candidates
- renégociation via WebSocket
- fallback polling
- cleanup à la déconnexion

La logique est riche, mais elle est sensible aux courses et difficile à maintenir.
Il faut rationaliser le cycle de vie et documenter précisément les états.

### 4. HLS coûteux et orienté serveur unique

Le bridge FFmpeg transcode vers plusieurs renditions HLS.
Cela implique:

- CPU élevé
- I/O disque pour les segments
- stockage temporaire local
- dépendance au cycle de vie du room process
- replay généré à partir des fichiers locaux

Le design est viable pour une démo ou une petite charge, mais pas pour une montée en charge sérieuse sans reprise d'architecture.

### 5. Doublons et code mort

Probables candidats à nettoyer:

- [front-web/src/lib/webrtc/useRoomWebRTC.ts](front-web/src/lib/webrtc/useRoomWebRTC.ts)
- [backend/internal/hls/token.go](backend/internal/hls/token.go) si aucun appel réel ne l'utilise
- [app/index.tsx](app/index.tsx) si le dossier racine n'est pas utilisé
- les dépendances LiveKit si aucun usage réel n'est confirmé

### 6. Tests de charge fonctionnels insuffisants

Le projet ne fournit pas encore de méthode simple pour simuler plusieurs utilisateurs simultanés en local.
Conséquence:

- la limite de 5 participants est difficile à reproduire proprement
- les cas de saturation et de renégociation concurrente sont peu testables sans plusieurs appareils ou comptes manuels
- il manque un harness local ou un script d'automatisation pour ouvrir plusieurs sessions client en parallèle

### 7. Documentation partiellement en décalage

Le README et la doc technique peuvent encore raconter une architecture plus propre ou plus stable que ce que le code montre réellement.
La documentation doit être réalignée avec l'implémentation actuelle, surtout sur le déploiement, la topologie réseau et la séparation web/mobile.

## Ce qu'il faut faire, par priorité

### P0

- rendre la topologie Docker compatible avec le besoin WebRTC UDP
- clarifier le chemin de déploiement local, VM et production
- supprimer ou assumer le squelette racine [app/index.tsx](app/index.tsx)
- sécuriser le flux OAuth web et le stockage de session
- confirmer noir sur blanc que le backend live est mono-instance, ou préparer une vraie stratégie multi-instance

### P1

- supprimer les hooks / services doublons ou morts
- harmoniser le contrat WebRTC web/mobile
- documenter la contrainte Expo development build
- ajouter des tests d'intégration sur auth, room, WebRTC, HLS et replay
- réviser les flux de cleanup et de déconnexion
- documenter analytics et son contrat de données
- ajouter un moyen de simulation multi-client local pour vérifier la saturation à 5 participants et les scénarios de concurrence

### P2

- nettoyer les dépendances non utilisées
- mettre à jour la documentation technique
- normaliser les variables d'environnement
- réduire le bruit dans les logs et les artefacts de debug

## Fichiers candidats à modifier ou supprimer

### Backend

- [backend/cmd/server/main.go](backend/cmd/server/main.go)
- [backend/internal/routes/routes.go](backend/internal/routes/routes.go)
- [backend/internal/modules/room/room.go](backend/internal/modules/room/room.go)
- [backend/internal/modules/room/websocket.go](backend/internal/modules/room/websocket.go)
- [backend/internal/hls/streamer.go](backend/internal/hls/streamer.go)
- [backend/internal/hls/manager.go](backend/internal/hls/manager.go)
- [backend/internal/hls/replay.go](backend/internal/hls/replay.go)
- [backend/internal/auth/auth.go](backend/internal/auth/auth.go)
- [backend/internal/auth/oauth_web.go](backend/internal/auth/oauth_web.go)
- [backend/internal/auth/oauth_mobile.go](backend/internal/auth/oauth_mobile.go)

### Front web

- [front-web/src/app/layout.tsx](front-web/src/app/layout.tsx)
- [front-web/src/app/(app)/layout.tsx](front-web/src/app/(app)/layout.tsx)
- [front-web/src/app/(app)/broadcast/[roomId]/page.tsx](front-web/src/app/(app)/broadcast/[roomId]/page.tsx)
- [front-web/src/app/(app)/watch/[roomId]/page.tsx](front-web/src/app/(app)/watch/[roomId]/page.tsx)
- [front-web/src/hooks/useWebRTC.ts](front-web/src/hooks/useWebRTC.ts)
- [front-web/src/lib/webrtc/useRoomWebRTC.ts](front-web/src/lib/webrtc/useRoomWebRTC.ts)
- [front-web/src/lib/useAuth.ts](front-web/src/lib/useAuth.ts)
- [front-web/src/services/streaming.ts](front-web/src/services/streaming.ts)

### Mobile Candidates

- [mobile/app/_layout.tsx](mobile/app/_layout.tsx)
- [mobile/app/live-streaming.tsx](mobile/app/live-streaming.tsx)
- [mobile/app/live-viewer.tsx](mobile/app/live-viewer.tsx)
- [mobile/app/live-rooms.tsx](mobile/app/live-rooms.tsx)
- [mobile/hooks/useWebRTC.ts](mobile/hooks/useWebRTC.ts)
- [mobile/services/streaming.ts](mobile/services/streaming.ts)
- [mobile/services/auth.ts](mobile/services/auth.ts)
- [mobile/components/HLSPlayer.tsx](mobile/components/HLSPlayer.tsx)
- [mobile/components/StreamView.native.tsx](mobile/components/StreamView.native.tsx)

### Analytics Candidates

- [analytics/package.json](analytics/package.json)
- [docker-compose.vm.yml](docker-compose.vm.yml)
- [analytics/](analytics/)

### Infra et racine Candidates

- [docker-compose.yml](docker-compose.yml)
- [docker-compose.dev.yaml](docker-compose.dev.yaml)
- [docker-compose.vm.yml](docker-compose.vm.yml)
- [nginx.conf](nginx.conf)
- [app/index.tsx](app/index.tsx)
- [package.json](package.json)
- [front-web/package.json](front-web/package.json)
- [mobile/package.json](mobile/package.json)

## Critères d'acceptation pour le prochain LLM

Le prochain agent doit considérer le travail terminé seulement si:

- WebRTC fonctionne en local sans contournement manuel non documenté
- le chemin de déploiement est cohérent entre dev et VM
- le flux de session auth est clair et moins exposé
- les doublons et fichiers morts sont supprimés ou explicitement justifiés
- le comportement du backend mono-instance est documenté ou corrigé
- la doc reflète l'état réel du projet
- analytics a un contrat d'exécution et de données clair

## Notes de lecture pour l'agent de code

- ne pas toucher aux changements non liés
- éviter les refactors larges sans objectif de stabilisation
- privilégier les corrections de contrat et d'infrastructure avant les optimisations de rendu
- ne pas supposer qu'un fichier mort est supprimable sans vérifier son usage

## Résultat attendu

L'objectif n'est pas de transformer le projet en architecture parfaite.
L'objectif est de le rendre:

- cohérent
- déployable
- plus sûr
- plus simple à maintenir
- plus explicite pour les prochains travaux
