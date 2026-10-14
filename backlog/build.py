#!/usr/bin/env python3
"""Generates backlog/issues/*.md and backlog/backlog.json from the data below (source: AUDIT_LIVE_WEBRTC.md)."""
import json, os, re, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
M2 = "Phase 2 – Fiabilité du live"
M3 = "Phase 3 – Autorisation et robustesse"
M4 = "Phase 4 – Mobile diffusion"
M5 = "Phase 5 – Échelle et qualité vidéo"
MT = "Qualité & tests"

I = []
def issue(title, prio, areas, effort, milestone, refs, problem, fix, accept, files):
    I.append(dict(title=title, priority=prio, areas=areas, effort=effort, milestone=milestone,
                  refs=refs, problem=problem, fix=fix, accept=accept, files=files))

# ---------------------------------------------------------------- Phase 2
issue("Reprise réseau du live : grâce de déconnexion, re-POST et redémarrage ICE", "critical", ["backend","mobile"], "L", M2,
 ["R1","M1"],
 "`Disconnected` est traité comme terminal (`room.go:2263`). Une coupure de ~5 s (Wi-Fi→4G, tunnel) retire le peer ; si l'hôte est seul, la room est supprimée, le replay est tronqué et la reconnexion répond 404. Le client mobile n'a ni NetInfo ni `restartIce()`, et sa grâce de 8 s est plus longue que celle du serveur : « Réessayer » crée une nouvelle room (replay coupé en deux).",
 "Backend : n'agir que sur `Failed`/`Closed`, timer 20-30 s sur `Disconnected` annulé si retour `Connected`, accepter un re-POST `/webrtc` du même utilisateur qui remplace son peer. Mobile : `@react-native-community/netinfo`, re-publication (ICE restart ou nouveau PC) avec backoff, message clair « connexion perdue » si abandon.",
 ["Une coupure réseau de 10 s pendant un live ne termine pas la room ni le replay",
  "Après retour du réseau le flux reprend dans la même room (test manuel sur appareil)",
  "Au-delà de la grâce, le live se termine proprement et l'utilisateur est informé",
  "Tests Go (machine d'états) et jest (reprise/abandon)"],
 ["backend/internal/modules/room/room.go","mobile/hooks/useWebRTC.ts"])

issue("Réconciliation au démarrage du serveur et timer « hôte absent »", "critical", ["backend"], "M", M2,
 ["H2","R8","R13"],
 "Aucun rapprochement d'état au boot : après un redémarrage, les lives `live` le restent pour toujours, les rooms persistent en base, l'hôte reçoit 409 à chaque création, les dossiers HLS ne deviennent jamais des replays. Si l'hôte tombe alors qu'un co-streamer reste, la room n'est pas terminée (`Connections != 0`), FFmpeg tourne sans entrée. Les lives `scheduled` jamais démarrés ne sont jamais purgés.",
 "Au démarrage : clôturer les lives `live` périmés, supprimer les rooms orphelines, générer le replay des dossiers HLS restants. Timer « hôte absent » (~60 s) qui termine le live. Janitor périodique pour les lives planifiés dépassés et les dossiers orphelins.",
 ["Redémarrer le backend en plein live laisse la base cohérente (live terminé, replay généré si possible)",
  "L'hôte peut recréer un live immédiatement après un crash",
  "Un live dont l'hôte est parti est terminé après le délai",
  "Test d'intégration de réconciliation"],
 ["backend/cmd/server/main.go","backend/internal/modules/room/room.go","backend/internal/hls"])

issue("Arrêt d'un live hors du verrou global (verrous par room)", "critical", ["backend"], "M", M2,
 ["R3","H1","R13"],
 "`HandleDisconnect` et `teardownEmptyRoom` tiennent le mutex global pendant `StopStream` (sleep 2 s, arrêt FFmpeg jusqu'à 5 s) et des appels BDD. Terminer un long live bloque join, ICE, renégociation, kick et le relais de tous les autres lives. (La copie du replay est déjà remplacée par un rename.)",
 "Détacher la room du registre sous verrou puis arrêter FFmpeg / finaliser / générer le replay / écrire en base hors verrou. Passer à un verrou par room ; marquer la room `closed` pour éviter les pointeurs périmés. Remplacer le `time.Sleep(2s)` par un drain basé sur le dernier segment.",
 ["Terminer un live n'interrompt pas les autres lives (test avec deux rooms)",
  "`go test -race` propre sur les scénarios join/reserve/cancel/kick concurrents"],
 ["backend/internal/modules/room/room.go","backend/internal/hls/manager.go"])

issue("Un seul PeerConnection par utilisateur et ré-attache de l'hôte au HLS", "high", ["backend"], "M", M2,
 ["R4","H16"],
 "`registerPeer` ajoute un second PC pour le même utilisateur sans fermer l'ancien : ICE et answers vont au PC périmé ; à la mort de l'ancien, l'état du nouveau est effacé. Après un rechargement de page de l'hôte, `HostPeerCon` pointe sur l'ancien PC, le nouveau n'est jamais source HLS : HLS et replay s'arrêtent. Reconnexion hôte : `seqNum`/timestamps remis à zéro sur le même writer.",
 "Clé de connexion par userID (fermer/remplacer), ne nettoyer que si le PC sortant est le courant, ré-attache de l'hôte comme source HLS, offsets continus de séquence/timestamp par writer.",
 ["Recharger la page hôte pendant un live conserve HLS et replay",
  "Les ICE/answers ciblent toujours le PC courant",
  "Tests de reconnexion du même utilisateur"],
 ["backend/internal/modules/room/room.go"])

issue("Supervision de FFmpeg : crash, redémarrage et arrêt propre", "high", ["backend"], "M", M2,
 ["H3","H11","H12"],
 "`cmd.Wait()` n'est appelé qu'à l'arrêt : un crash FFmpeg est invisible (playlist figée, `IsRunning` reste vrai, processus zombie). `tryStartHLS` n'est pas retenté après échec. Pas de `Pdeathsig`. La boucle de retry UDP est morte (`Dial udp4` n'échoue jamais) et le relais écrit avant que FFmpeg soit lié (1re IDR perdue). Allocation de port avec TOCTOU et plage éphémère chevauchant 50000-50100.",
 "Goroutine d'attente sur le process, redémarrage avec backoff (`append_list`), log de la fin de stderr, état « HLS indisponible » exposé, `Pdeathsig=SIGKILL`, arrêt par SIGTERM. Attendre la liaison/le premier segment avant d'écrire. Plage de ports dédiée hors ICE avec allocateur.",
 ["Tuer FFmpeg pendant un live le relance et le replay reste continu (test avec faux binaire)",
  "Aucun processus orphelin après arrêt du backend",
  "Pas de perte de la première keyframe au démarrage"],
 ["backend/internal/hls/streamer.go","backend/internal/hls/manager.go"])

issue("Renégociation robuste : TTL des offres, rollback et canal WebSocket côté mobile", "high", ["backend","mobile"], "M", M2,
 ["R5","M12","M13","M14"],
 "Une offre en attente n'expire jamais : si le client ne répond pas, il est bloqué pour toujours. `HandleRenegotiationAnswer` ne nettoie pas l'état en cas d'échec et accepte une answer sans offre en attente. Mobile : polling toutes les 1,2 s (~50 req/min), sans vérifier `signalingState`, sans rollback si `createAnswer` échoue, sans backoff sur 401/404 ; le canal WebSocket (seul à porter `kicked`) n'est pas utilisé.",
 "TTL ~10 s + rollback (`SetLocalDescription(rollback)`), identifiant d'offre, answer refusée sans offre en attente. Mobile : WebSocket en priorité, polling 3-5 s avec backoff en repli, rollback en cas d'échec, message clair quand l'utilisateur est expulsé.",
 ["Une offre non répondue est réémise ou annulée après le TTL",
  "Un participant expulsé voit un message explicite (pas de boucle de retry en 403)",
  "Le polling consomme < 15 req/min en régime stable"],
 ["backend/internal/modules/room/room.go","backend/internal/modules/room/websocket.go","mobile/hooks/useWebRTC.ts"])

issue("Fuites et abus dans HandleWebRTC : validation d'abord, un PC par utilisateur, mux UDP", "high", ["backend"], "M", M2,
 ["R7","N3"],
 "La place est consommée et le live passe « live » avant validation du SDP ; sur les retours d'erreur le PC n'est jamais fermé (sockets UDP gardés) ; pas de limite de taille de SDP ni de nombre de PC par utilisateur. Sans mux UDP, ~50 PC max sur 101 ports : une boucle de POST épuise les ports de toutes les rooms. Une mauvaise `WEBRTC_PORT_*` est seulement loguée.",
 "Valider le SDP avant tout effet de bord, fermer et désenregistrer le PC sur toute erreur, `MaxBytesReader` (~64 Ko), un PC par utilisateur, mux UDP unique (`NewICEUDPMux`), échec rapide sur configuration de ports invalide.",
 ["Un SDP invalide ne consomme ni place ni statut",
  "Aucune socket UDP n'est laissée ouverte après une erreur",
  "Test de charge : N POST répétés ne dégradent pas les autres rooms"],
 ["backend/internal/modules/room/room.go"])

# ---------------------------------------------------------------- Phase 3
issue("Autorisation de rejoindre une room et allocation atomique des places", "high", ["backend"], "M", M3,
 ["A1","A2"],
 "Tout utilisateur connecté qui POST `/webrtc?roomId=X` devient publieur tant que < 5 places (pas de réservation, d'approbation ni de contrôle de statut). Un tiers peut remplir les 5 places. Limite incohérente : `ReserveRoom` autorise 5 hors hôte, `ensureParticipant` compte l'hôte (6 vs 5) ; lecture-modification-écriture non atomique ; `5` en dur à ~6 endroits.",
 "Autoriser seulement l'hôte ou les utilisateurs réservés, statut `scheduled/live`. Une constante, allocation atomique (transaction `SELECT … FOR UPDATE` ou table de jointure avec index unique `(room, user)`).",
 ["Un utilisateur non réservé reçoit 403 sur `/webrtc`",
  "Deux réservations simultanées de la dernière place : une seule réussit",
  "Les 5 co-streamers réservés peuvent tous rejoindre"],
 ["backend/internal/modules/room/room.go"])

issue("Limites de requêtes : taille de corps, rate limit, timeouts serveur, uploads", "medium", ["backend"], "M", M3,
 ["A3","A4","H20"],
 "Aucun `MaxBytesReader`, aucun rate limit, `http.Server` sans timeouts (slowloris). ICE en attente sans plafond ni TTL ni contrôle d'appartenance (`/ice`, `/webrtc/offers/next` avec n'importe quel `roomId`). Upload : type MIME fait confiance au client, pas de limite de corps avant parsing, pas de quota.",
 "Middleware `MaxBytes`, limiteur IP/utilisateur (login, reserve, ice, answer, poll), `http.Server` avec `ReadHeaderTimeout/ReadTimeout/IdleTimeout`, plafonner l'ICE en attente (~50) et exiger d'être participant, uploads : `DetectContentType`, taille max, quota.",
 ["Un corps trop gros est rejeté en 413",
  "Un client qui dépasse le débit autorisé reçoit 429",
  "Test sur les endpoints de signalisation"],
 ["backend/cmd/server/main.go","backend/internal/modules/upload","backend/internal/modules/room/room.go"])

issue("Validation de la création de live, transaction et index unique partiel (409)", "medium", ["backend"], "M", M3,
 ["A5","A6","H18"],
 "`CreateNewRoom` : aucune limite de longueur, `Status` libre (peut publier un live « live » ou « ended » sans flux), `scheduledAt` passé accepté, durée négative/énorme, tags illimités, `ThumbnailURL` libre, Room/Live/Tags hors transaction (room orpheline si échec). Le 409 « live déjà actif » est vérifié puis inséré sans atomicité (double clic = deux lives), une ligne périmée bloque à vie, et le 409 ne renvoie pas le `roomId` existant.",
 "DTO avec `binding` (nom 3-80, titre ≤120, description ≤2000, ≤10 tags), statut en liste blanche (`scheduled`, `live` seulement après connexion de l'hôte), date future, transaction, index unique partiel `(user_id) WHERE status IN ('live','scheduled')`, renvoyer le `roomId` existant dans le 409.",
 ["Impossible de créer un live « ended » ou avec une date passée",
  "Un double POST simultané crée un seul live",
  "Le 409 permet au client de reprendre ou terminer le live existant"],
 ["backend/internal/modules/room/room.go","backend/internal/modules/live/model.go"])

issue("Kick fiable et persistant, suppression du code mort AddParticipant", "medium", ["backend"], "S", M3,
 ["A7","A8"],
 "`KickParticipant` : correspondance `strings.Contains` bidirectionnelle sur le stream id, 200 sans cible, `KickedUsers` en mémoire uniquement, un expulsé peut re-réserver ou revenir après redémarrage, son WS n'est pas fermé. `AddParticipant` n'est pas enregistré mais permet d'ajouter n'importe quel `userId` sans contrôle.",
 "Correspondance exacte, 404 si aucune cible, persister les expulsions (colonne/table) et les faire respecter par reserve et join, fermer le WS. Supprimer `AddParticipant` ou le restreindre à l'hôte.",
 ["Un expulsé ne peut ni re-réserver ni rejoindre, même après redémarrage",
  "Kick sans cible renvoie 404"],
 ["backend/internal/modules/room/room.go","backend/internal/modules/room/websocket.go"])

issue("Jetons : n'accepter `?token=` que pour le WebSocket (ticket court), cookies et logs", "medium", ["backend","web"], "M", M3,
 ["A9","A10","B4"],
 "`?token=` est accepté sur toutes les routes `/api` et le logger gin écrit la query string : les JWT finissent dans stdout/proxies. Les cookies `token`/`auth_token` sont acceptés sur toutes les routes (CSRF possible avec CORS `*`). Le web met le JWT dans l'URL du WS. Logs : SDP complet et candidats ICE (IP clients) en INFO, `err.Error()` renvoyé aux clients, `console.log` des corps ICE côté web.",
 "`?token` uniquement sur la route WS, idéalement un ticket à usage unique ; pas de cookie sur les routes mutantes (ou en-tête CSRF) ; `GIN_MODE=release` + logger qui masque la query ; `jwt.WithValidMethods`; messages d'erreur génériques ; supprimer les `console.log`.",
 ["Les JWT n'apparaissent plus dans les logs",
  "Un appel mutant avec cookie seul est refusé",
  "Le WS fonctionne avec un ticket court"],
 ["backend/internal/middleware/auth.go","backend/internal/modules/room/websocket.go","front-web/src/hooks/useWebRTC.ts","front-web/src/services/streaming.ts"])

issue("Qualité WebRTC du SFU : intercepteurs Pion, debounce PLI/FIR, recover des goroutines", "medium", ["backend"], "M", M3,
 ["R10","R11","R12"],
 "Aucun intercepteur Pion (NACK, TWCC, REMB, RR) : gels et artefacts sur réseaux mobiles avec pertes. Chaque join/answer déclenche une rafale de 10 PLI+FIR par piste et les PLI/FIR des abonnés sont relayés sans limite : la source émet des keyframes en continu. Les goroutines relais/RTCP/renégociation n'ont pas de `recover` : un bug de parsing (H264/STAP-A/VP8) tue le serveur.",
 "`webrtc.RegisterDefaultInterceptors`, debounce à 1 keyframe/s par SSRC source, wrapper `safeGo` avec `recover` et log.",
 ["Les paquets perdus sont retransmis (NACK) et la qualité s'adapte au débit",
  "N joins simultanés ne génèrent pas N rafales de keyframes",
  "Une panique dans un relais n'arrête pas le serveur (test)"],
 ["backend/internal/modules/room/room.go"])

issue("Politique de codecs et HLS : H264 imposé, vidéo seule, VP8, une piste hôte source", "medium", ["backend"], "M", M3,
 ["N4","H15","R9","N5"],
 "Un publieur VP8/VP9 obtient un live « live » sans HLS ni replay ; `resolveCodec` retombe sur PT 0 (piste liée à rien) ; profils H264 mixtes non filtrés. `tryStartHLS` exige ≥ 2 pistes : un hôte sans micro n'a pas de HLS. Toute piste hôte devient source HLS : deux caméras entrelacent leur RTP et corrompent le flux.",
 "MediaEngine restreint à Opus + H264 (`42e01f`, packetization-mode=1) côté publieur, rejet visible sans codec commun, démarrer le HLS en vidéo seule, choisir une piste audio et une vidéo comme source, exposer un état « HLS indisponible » dans l'API et l'UI, filtrer l'audio par PT.",
 ["Un publieur sans codec commun reçoit une erreur claire à la connexion",
  "Un hôte sans micro obtient quand même HLS et replay",
  "Deux pistes vidéo n'altèrent pas le HLS"],
 ["backend/internal/modules/room/room.go"])

issue("Durcissement du conteneur et de la base : multi-stage, non-root, mode release", "medium", ["infra","backend"], "S", M3,
 ["H22","A10"],
 "Dockerfile mono-étage sur `golang:alpine` (toolchain et sources dans l'image), exécuté en root, sans init (zombies FFmpeg). Postgres publié sur 0.0.0.0 avec `root/root` par défaut, secrets passés par `env_file`+`environment`, build args du front codés sur `localhost`. `GIN_MODE` non défini (mode debug en prod). `gorm.Open` : erreurs non propagées, pas de pool ni de retry. Schéma via `AutoMigrate` avec erreurs d'index ignorées.",
 "Build multi-étapes vers `alpine` (ffmpeg, ca-certificates, tini), utilisateur non-root (droits sur le volume), `GIN_MODE=release`, publier Postgres sur 127.0.0.1 (ou ne pas le publier), supprimer les mots de passe par défaut, propager les erreurs DB + pool, adopter des migrations versionnées, `validate` des chemins avec `uuid.Parse`.",
 ["L'image finale ne contient ni toolchain ni sources et ne tourne pas en root",
  "Postgres n'est pas joignable depuis le réseau externe par défaut",
  "Une erreur de connexion DB fait échouer le démarrage"],
 ["backend/Dockerfile","docker-compose.yml","backend/internal/db"])

# ---------------------------------------------------------------- Phase 4
issue("Diffuseur mobile : maintien en arrière-plan, keep-awake et permissions", "critical", ["mobile"], "L", M4,
 ["M2","M11"],
 "Aucun service de premier plan Android, aucun `UIBackgroundModes` iOS, pas d'`expo-keep-awake` : verrouiller l'écran ou changer d'app coupe caméra/micro (images noires, micro muet) et, ~5 s plus tard, le live. L'écran d'hôte s'éteint en plein direct. `inactive` (Centre de contrôle iOS) coupe aussi la vidéo inutilement.",
 "`useKeepAwake` pendant `connecting/live`, service de premier plan caméra+micro (+ `POST_NOTIFICATIONS` Android 13), plugin `@config-plugins/react-native-webrtc`, `UIBackgroundModes` (audio, voip), ne réagir qu'à `background`, état « en pause » explicite.",
 ["Verrouiller le téléphone 30 s pendant un live ne coupe pas la diffusion (Android et iOS)",
  "L'écran reste allumé pendant le live",
  "Checklist manuelle sur appareils réels documentée"],
 ["mobile/app.json","mobile/hooks/useWebRTC.ts","mobile/app/live-streaming.tsx"])

issue("Écran hôte mobile : chat, compteur de spectateurs et expulsion", "high", ["mobile"], "M", M4,
 ["M3"],
 "L'écran de diffusion n'a ni chat, ni nombre de spectateurs, ni moyen d'expulser un co-streamer (le web a les trois). C'est le flux principal du produit.",
 "Panneau de chat repliable (réutiliser `ChatPanel`), compteur via `/rooms/:id`, ajouter `kickParticipant` au service et une action par participant avec confirmation.",
 ["L'hôte lit et envoie des messages pendant le live",
  "Le nombre de spectateurs est visible et mis à jour",
  "L'hôte peut expulser un co-streamer"],
 ["mobile/app/live-streaming.tsx","mobile/services/streaming.ts","mobile/components/live/ChatPanel.tsx"])

issue("Multi-flux : grille de participants et tuiles périmées", "high", ["mobile"], "M", M4,
 ["M4","M5","M15"],
 "Un seul flux distant est affiché (PiP 120×90) sur 5 co-streamers, choisi arbitrairement. Les tuiles périmées ne sont pas retirées (pas de timer sur `mute`, `ended` non filtré, repli sur `remoteStreams[0]`) : un co-streamer parti laisse une image figée. Chaque `mute/unmute` recrée le tableau et re-rend tout l'écran.",
 "Grille de jusqu'à 6 tuiles ou échange au toucher, libellés, ne décoder que les tuiles visibles ; timer 5 s sur `mute` (comme le web), `onremovetrack`, filtrer `ended`, mémoïser les tuiles.",
 ["Avec 5 co-streamers tous sont visibles ou accessibles",
  "Un participant qui part disparaît en < 6 s",
  "Pas de re-rendu complet sur simple `mute`"],
 ["mobile/app/live-streaming.tsx","mobile/hooks/useWebRTC.ts"])

issue("Perte de capture locale et interruptions (appel, autre app, permission révoquée)", "high", ["mobile"], "M", M4,
 ["M6","M16"],
 "Aucun écouteur `ended` sur les pistes locales : si une autre app prend la caméra, qu'un appel arrive ou que la permission est révoquée, l'aperçu fige et la pastille reste « LIVE ». La lumière de la caméra peut rester allumée.",
 "Écouter `ended`/`mute` sur les pistes locales, bannière claire, ré-acquisition (`getUserMedia` + `replaceTrack`) au retour au premier plan, gestion des interruptions iOS/Android.",
 ["Une caméra prise par une autre app affiche un état d'erreur explicite",
  "Au retour la capture est rétablie sans recréer la room"],
 ["mobile/hooks/useWebRTC.ts"])

issue("Reprise après crash de l'app : persister le roomId et résoudre le 409", "high", ["mobile","backend"], "M", M4,
 ["M7"],
 "Le `roomId` n'est conservé qu'en mémoire : si le réseau est coupé à l'arrêt, `disconnectRoom` échoue en silence ; au lancement suivant « Lancer le live » donne 409 sans issue. Studio ne contrôle que les lives planifiés.",
 "Persister le `roomId` actif (SecureStore) et retenter `disconnect` au lancement ; sur 409, proposer « reprendre » ou « terminer mon live actif » (le backend renvoie le `roomId` existant) ; faire contrôler à Studio aussi les lives actifs.",
 ["Après un kill de l'app, l'utilisateur peut terminer ou reprendre son live depuis Studio",
  "Aucun 409 sans action proposée"],
 ["mobile/hooks/useWebRTC.ts","mobile/app/(tabs)/studio.tsx"])

issue("Audio mobile : routage haut-parleur / écouteur / Bluetooth et réinitialisation", "medium", ["mobile"], "M", M4,
 ["M10"],
 "Aucune gestion de session audio : un co-streamer entend l'hôte sur l'écouteur ou à bas volume selon les défauts de l'OS, le Bluetooth n'est pas routé volontairement, et le mode « communication » peut rester actif après `stopLive` (musique d'autres apps atténuée).",
 "Couche de routage audio (haut-parleur par défaut, casque/Bluetooth suivis), réinitialiser le mode à la libération.",
 ["Le son sort sur le haut-parleur par défaut et suit un casque branché",
  "Après un live, l'audio des autres apps est normal"],
 ["mobile/hooks/useWebRTC.ts"])

issue("Contraintes de capture et SDP : résolution/débit adaptés au mobile, setCodecPreferences", "medium", ["mobile"], "M", M4,
 ["M13","M14"],
 "Capture fixe 1280×720@30, face avant, sans plafond de débit ni `degradationPreference` ni flags audio (le web : 854×480@24 avec echo/noise/AGC). La manipulation SDP par regex (`preferH264`) peut choisir un profil H264 non transférable, et le SDP posté n'est pas comparé à `localDescription`.",
 "640×360 à 960×540 par défaut, plafond ~1,2-1,5 Mbps via `setParameters`, `maintain-framerate`, flags audio, caméra arrière par défaut pour la cuisine ; `transceiver.setCodecPreferences` à la place de la regex.",
 ["Le débit montant reste ≤ 1,5 Mbps",
  "Plus de manipulation SDP par regex, H264 `42e01f` négocié"],
 ["mobile/hooks/useWebRTC.ts","mobile/utils/webrtcSdp.ts"])

issue("Configuration de production mobile : URL de l'API, permissions et textes iOS", "high", ["mobile"], "S", M4,
 ["M9"],
 "`eas.json` ne définit aucun `env` : un build de production sans `EXPO_PUBLIC_API_BASE_URL` n'a pas d'API (le repli `localhost` a été retiré). Le manifest Android déclare `SYSTEM_ALERT_WINDOW`, stockage externe, `VIBRATE`… inutiles pour la release, `allowBackup=true`. Les textes iOS (caméra, micro, Face ID) sont génériques et non localisés.",
 "Définir `EXPO_PUBLIC_API_BASE_URL` (https) par profil EAS, faire échouer le build si absente ou non https en production, `blockedPermissions`, `allowBackup=false`, `InfoPlist.strings` FR/EN.",
 ["Un build preview/production pointe sur la bonne API https",
  "Le manifest de release ne contient que les permissions utiles",
  "Les demandes de permission iOS sont localisées"],
 ["mobile/eas.json","mobile/app.json","mobile/android/app/src/main/AndroidManifest.xml"])

issue("Lecture HLS spectateur mobile : bord du direct, bouton « Direct », stalls, orientation", "high", ["mobile"], "M", M4,
 ["P1","P2"],
 "Sur natif il n'y a ni `targetOffsetFromLive`, ni bouton « Direct », et la playlist est de type EVENT (iOS démarre au début). Le chien de garde n'est pas réarmé après `readyToPlay` : un gel sans erreur n'est jamais rechargé. `orientation: portrait` rend le layout paysage inaccessible et le lecteur change de position dans l'arbre selon l'orientation (remontage sur iPad). Aucun choix explicite sur la lecture en arrière-plan / PiP.",
 "Définir `targetOffsetFromLive`, bouton « Direct » (seek au bord), surveiller `isLive`/buffering et recharger après ~10 s de gel, autoriser le paysage sur l'écran du live avec le lecteur à position stable, décider et configurer arrière-plan/PiP (`expo-video` plugin). Dépend de la fenêtre glissante HLS côté backend.",
 ["Un spectateur qui arrive en cours de live démarre au bord du direct",
  "Un gel de lecture déclenche un rechargement automatique",
  "Le plein écran paysage fonctionne sans redémarrer la lecture"],
 ["mobile/components/HLSPlayer.tsx","mobile/app/live-viewer.tsx","mobile/app.json"])

issue("Chat : performances, séquence des réponses et dédoublonnage", "medium", ["mobile","backend"], "M", M4,
 ["C1","C2","C3"],
 "Chaque sondage (5 s) remplace tout le tableau (re-rendu complet de la liste, sans `since`, sans plafond, sondage actif onglet masqué) ; pas de garde de séquence (une vieille réponse écrase une récente) ni de garde « déjà en vol » (`usePolling`). Dédoublonnage des messages en attente par texte seul ; pas de rate limit client ni de modération/signalement. La page hôte web interroge `/rooms` (liste complète) toutes les 3 s.",
 "Comparer le dernier id et ne pas re-rendre si inchangé, `?after=` côté backend, plafonner ~200 lignes, garde de séquence et garde « en vol », pause hors focus/onglet masqué, identifiant client pour le dédoublonnage, limite d'envoi, `/rooms/:id` côté web.",
 ["La liste ne se re-rend pas quand rien n'a changé",
  "Deux messages identiques consécutifs s'affichent correctement",
  "Pas de requêtes empilées sur réseau lent"],
 ["mobile/components/live/ChatPanel.tsx","mobile/hooks/usePolling.ts","backend/internal/modules/chat"])

issue("Web : l'hôte libère caméra et room en cas d'erreur, lecteur replay et nettoyage", "high", ["web"], "S", M4,
 ["B2","B3","B4","B5","P5"],
 "Dans le hook web, un échec ne fait que `setState('error')` : caméra, micro et PeerConnection restent ouverts et la room créée est orpheline ; `disconnected` ne libère rien et ne notifie pas le backend. Replay : erreurs réseau non retentées, `<track kind=\"captions\">` vide ; configuration hls.js incohérente entre `front-web` et le lecteur mobile web ; `setTimeout(playVideo)` non nettoyé ; `createRoom` ne transmet que `{name}` et affiche « Failed to create room (409) » brut.",
 "Faire passer tous les échecs par le même nettoyage que `stopLive` (y compris `disconnectRoom`), politique de retry bornée partagée avec le mobile, config hls.js unique, vrais sous-titres ou suppression de la balise, nettoyer les timers, transmettre titre/description/tags et mapper le 409.",
 ["Un échec de démarrage ne laisse ni caméra allumée ni room orpheline",
  "Les erreurs réseau du replay sont retentées avec plafond"],
 ["front-web/src/hooks/useWebRTC.ts","front-web/src/app/(app)/replays/[id]/page.tsx","front-web/src/services/streaming.ts"])

issue("Parité des replays sur mobile : reprise, vitesse, qualité", "low", ["mobile"], "M", M4,
 ["P4"],
 "Sur natif il n'y a ni reprise de position, ni vitesse de lecture, ni sélecteur de qualité (le web en a un).",
 "Mémoriser la position par replay, menu vitesse, sélecteur de qualité si disponible via expo-video.",
 ["Reprendre un replay au point où on l'a quitté"],
 ["mobile/components/HLSPlayer.tsx"])

# ---------------------------------------------------------------- Phase 5
issue("TURN et repli TCP/TLS pour les réseaux restrictifs", "high", ["infra","backend","mobile","web"], "M", M5,
 ["N1","N2","M15"],
 "Seul un STUN public est proposé : derrière un NAT symétrique, un Wi-Fi d'entreprise ou certains réseaux mobiles, ni publication ni lecture WebRTC ne fonctionne, avec pour seul retour « grâce de 8 s ». Le serveur n'offre que des candidats UDP host. `WEBRTC_IP` retombe sur `127.0.0.1` (déjà un avertissement, pas de contrôle en production).",
 "Déployer coturn (UDP/TCP/TLS 443), endpoint d'identifiants courts consommé par les clients, `SetICETCPMux` côté serveur, erreur explicite « connexion impossible » après ~15 s en `connecting`, vérification de `WEBRTC_IP` en production.",
 ["Publication et lecture fonctionnent avec l'UDP bloqué",
  "Les clients reçoivent des identifiants TURN éphémères"],
 ["docker-compose.yml","backend/internal/modules/room/room.go","mobile/hooks/useWebRTC.ts","front-web/src/hooks/useWebRTC.ts"])

issue("Transcodage maîtrisé : échelle selon la source, portrait, audio encodé une fois, plafond de lives", "high", ["backend","infra"], "L", M5,
 ["H4","H5","H14"],
 "4 encodages x264 par live (le 1080p est toujours produit, même pour une source 480p/720p), AAC encodé 4 fois, aucun plafond de lives simultanés ni limite CPU, dans le même conteneur que l'API et le SFU. Les vidéos portrait (téléphone) sont letterboxées en 16:9 (`pad=1920:1080`) dans toutes les renditions et le replay.",
 "Choisir l'échelle selon la résolution source, supprimer le pad (`scale=-2:720`), audio encodé une fois, sémaphore de lives HLS avec mode dégradé, limites de ressources compose, envisager un worker FFmpeg séparé.",
 ["Un live portrait 720p reste portrait dans toutes les renditions",
  "Un 4ᵉ live simultané ne dégrade pas le SFU (test de charge)"],
 ["backend/internal/hls/streamer.go","docker-compose.yml"])

issue("Playlist HLS en fenêtre glissante, rétention et janitor de stockage", "high", ["backend"], "M", M5,
 ["H6","H22"],
 "Playlist EVENT illimitée (`hls_list_size 0`, pas de `delete_segments`) : chaque spectateur retélécharge toute la playlist (~300 Ko / 2 s sur 3 h), iOS démarre au début, aucune rétention des dossiers HLS ni des replays. Divers : master écrit avant les variantes, `stream.sdp` servi publiquement et copié dans chaque replay, goroutine de log toutes les 2 s par live.",
 "Fenêtre glissante pour le direct, replay construit depuis un enregistrement séparé (second output ou copie), `EXT-X-START`, janitor + politique de rétention/quota pour `hls` et `storage/replays`, écrire `stream.sdp` hors du dossier servi.",
 ["La playlist d'un live de 3 h reste < 20 Ko",
  "Le replay contient bien tout le live",
  "Les dossiers orphelins sont nettoyés automatiquement"],
 ["backend/internal/hls/streamer.go","backend/internal/hls/manager.go"])

issue("Compteurs de spectateurs et de vues (direct et replays)", "high", ["backend","mobile","web"], "M", M5,
 ["H9"],
 "`view_count`, `current_viewers`, `replay_views` et `Room.Viewers` ne sont jamais écrits (les spectateurs HLS sont de simples requêtes statiques) : les tris « vues/spectateurs », les totaux et les badges sont toujours à 0.",
 "Heartbeat spectateur (`POST /lives/:id/view` toutes les 15 s, ensemble avec TTL) pour `current_viewers`, vues uniques par utilisateur/IP, `replay_views` au démarrage du replay, écritures `UPDATE … SET x = x+1`.",
 ["Le nombre de spectateurs reflète les lecteurs actifs (± 15 s)",
  "Les tris par vues/spectateurs fonctionnent"],
 ["backend/internal/modules/live","backend/internal/modules/discover","mobile/components/HLSPlayer.tsx"])

issue("Replays : durée, miniatures, suppression d'un live actif et tri", "medium", ["backend"], "M", M5,
 ["H7","H17","H21"],
 "La durée du replay n'est jamais mesurée (seulement la durée prévue), aucune miniature ni `preview_gif` n'est générée (les lives créés depuis le mobile n'ont pas de visuel), les lives plus courts que le premier segment n'ont pas de replay. `DELETE /lives/:id` pendant un live ne coupe ni FFmpeg ni la room et le replay est quand même copié vers un dossier orphelin. `GetLives` trie `COALESCE(scheduled_at, created_at) ASC` pour tous les statuts (replays du plus ancien au plus récent) sans tie-breaker (pagination qui duplique/saute).",
 "Mesurer la durée réelle, miniature et aperçu via FFmpeg, refuser `DELETE` sauf si `ended` (ou démonter d'abord), tri par statut avec `id` en tie-breaker.",
 ["Chaque replay a une durée et une miniature",
  "Supprimer un live actif est refusé ou arrête proprement tout",
  "Les replays sont listés du plus récent au plus ancien sans doublons"],
 ["backend/internal/modules/live/handler.go","backend/internal/hls/replay.go"])

issue("Synchronisation A/V et co-streamers dans le HLS et le replay", "medium", ["backend"], "L", M5,
 ["H13","H14"],
 "Seul l'hôte est dans le HLS : les co-streamers (jusqu'à 5) ne sont ni visibles ni audibles pour les spectateurs HLS et le replay. `use_wallclock_as_timestamps` sans RTCP SR transmis risque une dérive audio/vidéo (non mesurée).",
 "Compositeur/mixeur des pistes des co-streamers (ou documenter la limite), transmettre les RTCP SR à FFmpeg ou ajouter un petit jitter buffer, mesurer la dérive.",
 ["Les co-streamers apparaissent dans le HLS ou la limite est documentée et affichée",
  "Dérive A/V < 100 ms sur un live de 30 min"],
 ["backend/internal/modules/room/room.go","backend/internal/hls/streamer.go"])

issue("DTO de live public : ne plus embarquer les listes de followers", "medium", ["backend"], "S", M3,
 ["H19"],
 "`LiveToDTO` inclut `UserDTO` avec `followingIds` et `followersIds` de l'hôte dans `/api/lives`, `/api/lives/:roomId` et discover (publics, sans authentification) : un hôte avec 100 000 followers met 100 000 identifiants dans chaque carte.",
 "DTO résumé (id, pseudo, avatar, drapeaux, compteurs) pour les lives et les listes.",
 ["Le JSON d'un live ne contient plus de listes d'identifiants de followers",
  "Le client web et mobile fonctionnent sans ces champs"],
 ["backend/internal/modules/live/dto.go","backend/internal/modules/user/dto.go"])

issue("Performance des listes et de discover : recherche, index, cache, catégories", "low", ["backend"], "M", M5,
 ["H21","H18","H22"],
 "`ILIKE '%q%'` non échappé (wildcards, scan séquentiel), `status` non validé, `status=all` exclut `ended`. `GetDiscover` fait des `GROUP BY` complets sans cache à chaque appel ; `GetCategoryLives` compte tous les statuts. `CountryID`/`DishID` ne sont jamais renseignés (catégories toujours vides). `room_id` non unique, pas d'index composites `(status, scheduled_at/created_at)`.",
 "Échapper les wildcards et passer à `pg_trgm`/full-text, valider `status`, cache court pour discover, renseigner pays/plat à la création, `uniqueIndex` sur `room_id` et index composites.",
 ["Les requêtes de liste utilisent des index (EXPLAIN)",
  "Les catégories de discover contiennent des lives"],
 ["backend/internal/modules/live","backend/internal/modules/discover"])

issue("Visibilité des lives : privé / non listé (décision produit)", "medium", ["backend","mobile","web"], "M", M5,
 ["H18"],
 "`Visibility` est accepté à la création mais jamais persisté ni appliqué : tous les lives et replays sont publics et `/api/hls/*` et `/replays-storage/*` n'exigent aucune authentification (une URL divulguée donne un accès permanent).",
 "Décider si les lives privés/non listés sont un besoin ; si oui, persister `visibility`, filtrer les listes, protéger HLS/replay (URLs signées ou jeton court) et l'exposer dans Studio. Sinon retirer le champ.",
 ["Décision produit documentée",
  "Si retenu : un live privé n'est visible que par ses invités"],
 ["backend/internal/modules/room/room.go","backend/internal/modules/live"])

# ---------------------------------------------------------------- Qualité & tests
issue("CI : lancer les tests et les contrôles backend, mobile et web sur chaque PR", "high", ["infra"], "S", MT,
 ["Tests"],
 "La CI actuelle (`.github/workflows/ci.yml`) se contente de compiler le binaire du backend : aucun `go test`, aucun job mobile ni web. Les 570+ tests mobile, les tests Go et les vérifications de types ne protègent donc aucune PR.",
 "Jobs séparés : backend (`go vet`, `go test -race ./...`), mobile (`npm ci`, `npx tsc --noEmit`, `npx expo lint`, `npm test`), web (`npx tsc --noEmit`, lint) avec cache des dépendances ; exiger ces checks sur `main`.",
 ["Une PR qui casse un test ou un type échoue en CI",
  "Les checks sont requis par la protection de branche"],
 [".github/workflows/ci.yml"])

issue("Tests backend : concurrence, handlers de rooms, HLS, live et upload", "high", ["backend"], "L", MT,
 ["Tests"],
 "`room_test.go` ne contient que quelques tests triviaux ; rien sur les handlers, la machine d'états du live, la concurrence (`-race`), les 409, la reconnexion, la grâce de déconnexion, le kick, ICE/answer, le WebSocket, les parseurs STAP-A/FU-A/VP8 (à fuzzer), le middleware d'auth. Les paquets `modules/live`, `discover` et `upload` n'ont aucun test, `internal/hls` n'en a que pour le replay.",
 "Tests avec `-race` (join/reserve/cancel/kick concurrents), table tests des handlers, faux binaire FFmpeg (démarrage/crash/arrêt), replay depuis un dossier fixture, test d'intégration à deux clients Pion, test de réconciliation au démarrage, fuzz des parseurs RTP.",
 ["`go test -race ./...` passe en CI",
  "Couverture des machines d'états de room et de live"],
 ["backend/internal/modules/room","backend/internal/hls","backend/internal/modules/live","backend/internal/modules/upload"])

issue("Tests mobile et checklist manuelle sur appareil pour le live", "medium", ["mobile"], "M", MT,
 ["Tests"],
 "Les tests mockent le hook `useWebRTC`/`StreamView` ou le PeerConnection : ils ne révèlent ni les vrais événements `ended`/`mute` de react-native-webrtc, ni les transitions `AppState`, ni un changement de réseau, une permission révoquée, un flux distant retiré, le 409 côté UI, l'échec de renégociation ou le gel du lecteur. Les comportements natifs (service de premier plan, routage audio, interruptions iOS, Bluetooth) ne sont pas testables avec jest.",
 "Ajouter les tests manquants côté jest (AppState du hook, `preferH264` sur de vrais SDP, 409, renégociation, gel du lecteur) et une checklist manuelle versionnée (appareils Android/iOS) exécutée avant chaque release ; envisager un test e2e (Detox/Maestro).",
 ["Checklist manuelle dans le dépôt, exécutée avant release",
  "Les scénarios listés sont couverts par des tests"],
 ["mobile/hooks/__tests__/useWebRTC.test.ts","mobile/app/__tests__/live-streaming.test.tsx"])

# ---------------------------------------------------------------- output
def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode()
    return re.sub(r"[^a-z0-9]+","-",s.lower()).strip("-")[:60]

os.makedirs(os.path.join(HERE,"issues"), exist_ok=True)
for f in os.listdir(os.path.join(HERE,"issues")):
    os.remove(os.path.join(HERE,"issues",f))

out=[]
for n,it in enumerate(I,1):
    # same label scheme as the existing "Foodstream" project: P0..P3 for priority, S/M/L for size
    PRIORITY_LABEL = {"critical": "P0", "high": "P1", "medium": "P2", "low": "P3"}
    labels=[PRIORITY_LABEL[it['priority']]]+[f"area:{a}" for a in it['areas']]+[it['effort'],"audit"]
    body = (f"> Source : `AUDIT_LIVE_WEBRTC.md` — constats {', '.join(it['refs'])}\n\n"
            f"## Problème\n{it['problem']}\n\n## Correctif proposé\n{it['fix']}\n\n"
            "## Critères d'acceptation\n" + "\n".join(f"- [ ] {a}" for a in it['accept']) +
            "\n\n## Fichiers concernés\n" + "\n".join(f"- `{p}`" for p in it['files']) + "\n")
    fn=f"{n:02d}-{slug(it['title'])}.md"
    open(os.path.join(HERE,"issues",fn),"w").write(f"# {it['title']}\n\n"+body)
    out.append(dict(n=n,file=f"issues/{fn}",title=it['title'],labels=labels,milestone=it['milestone'],body=body))
json.dump(out, open(os.path.join(HERE,"backlog.json"),"w"), ensure_ascii=False, indent=2)
print(len(out),"issues")
