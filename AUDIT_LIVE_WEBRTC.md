# Audit WebRTC / Live / Rediffusion

Audit en lecture seule du backend Go (signalisation, SFU Pion, HLS/FFmpeg, replays) et des clients (mobile Expo, web Next.js).
Trois audits indépendants, consolidés ici. Les points marqués **(vérifié)** ont été relus dans le code par le relecteur final ;
les autres viennent des auditeurs et sont fondés sur le code (marqués *non vérifié* quand déduits, ex. comportement natif).
Aucun test d'exécution (charge, appareil réel, `-race`) n'a abouti : les points de concurrence sont à confirmer sous `go test -race`.

Sévérités : **C** critique · **H** haute · **M** moyenne · **B** basse. Effort : S < ½ j · M 1-3 j · L > 3 j.

## 0. Les 12 priorités

| # | Sév. | Problème | Effort |
|---|---|---|---|
| 1 | C | Une coupure réseau de ~5 s termine définitivement le live (`Disconnected` traité comme terminal, aucune reprise possible) — **vérifié** `room.go:2263` | M (+L côté client) |
| 2 | C | Lives jamais terminés après redémarrage/crash serveur ou départ de l'hôte avec un co-streamer ; l'hôte est ensuite bloqué par le 409 — **vérifié** (aucune réconciliation au démarrage) | M |
| 3 | C | Accès concurrent non protégé à la carte `liveRooms` (`getLiveRoom` sans verrou) : un `fatal error: concurrent map` tue tous les lives — **vérifié** `room.go:124`, à confirmer sous `-race` | M |
| 4 | C | Mutex global tenu pendant l'arrêt d'un live (sleep 2 s, arrêt FFmpeg, copie complète du replay) : tous les lives gèlent | M |
| 5 | C | Mobile : aucun maintien en arrière-plan pour un diffuseur (pas de service de premier plan Android, pas de `UIBackgroundModes` iOS, pas de keep-awake) : verrouiller l'écran coupe le live | M-L |
| 6 | H | Replays et uploads perdus à chaque recréation du conteneur (aucun volume) + 139 fichiers média suivis par git — **vérifié** | S |
| 7 | H | Autorisation de rejoindre absente : tout utilisateur connecté devient publieur d'une room (limite de 5 places remplissable par un tiers) | M |
| 8 | H | Un échec de génération du replay détruit la source (`RemoveAll` inconditionnel) | S |
| 9 | H | FFmpeg non supervisé (crash silencieux) et 4 encodages x264 par live sans plafond | M |
| 10 | H | Pas de TURN ni de repli TCP : échec complet derrière NAT strict / réseaux d'entreprise | M |
| 11 | H | Compteurs de spectateurs jamais écrits (toujours 0) | M |
| 12 | H | Pas de chat, de compteur de spectateurs ni de kick sur l'écran hôte mobile (flux principal du produit) | M |

## 1. Backend — signalisation, rooms, SFU

### Cycle de vie et concurrence
| ID | Sév. | Constat (fichier:ligne approx.) | Scénario | Correctif |
|---|---|---|---|---|
| R1 | C | `Disconnected` terminal (`room.go:2263-2267`, `2084-2140`) | Wi-Fi→4G 6 s : peer retiré, room supprimée si hôte seul, replay tronqué, reconnexion = 404. Retire aussi la réservation en base | Agir sur `Failed/Closed` ; timer 15-30 s sur `Disconnected` annulé si retour `Connected` |
| R2 | C | `getLiveRoom` lit/écrit `liveRooms` sans verrou depuis le WebSocket (`websocket.go:111`) ; `ensureParticipant` modifie `Participants`/`KickedUsers` sans verrou (`1196-1217`, appelé après `mu.Unlock()` à `2309`) | Crash fatal du processus | Verrou par room + verrou sur la carte |
| R3 | H | `mu` global tenu pendant `StopStream` (sleep 2 s, arrêt FFmpeg, copie replay) et pendant des appels BDD (`990-1008`, `2054-2067`, `605-657`) | Fin d'un live de 2 h = gel de tous les lives | Détacher la room sous verrou, arrêter/copier hors verrou ; verrous par room |
| R4 | H | Reconnexion du même utilisateur : second PeerConnection sans fermer l'ancien (`1259-1273`, `161-168`) ; ICE/answers vont au PC périmé ; à la mort de l'ancien, l'état du nouveau est effacé ; `HostPeerCon` jamais ré-attaché (HLS arrêté) | Rechargement de page de l'hôte : plus de HLS ni de replay | Un PC par utilisateur (fermer/remplacer), ne nettoyer que si le PC sortant est le courant, ré-attache hôte |
| R5 | H | Renégociation pouvant se bloquer définitivement : offre en attente sans TTL, `HandleRenegotiationAnswer` ne nettoie pas en cas d'échec, `sendOfferToUser` « délivre » vers un writer mort (`196-210`, `1117-1187`) | Utilisateur sans nouvelles pistes jusqu'à la fin | TTL 10 s + rollback, exiger une offre en attente, identifiant d'offre |
| R6 | H | WebSocket : `unregisterWSConnection` supprime la **nouvelle** connexion (pas de comparaison de pointeur) ; pas de `SetReadLimit`, ni ping/pong, ni deadline d'écriture ; non fermés à la fin de room/kick (`websocket.go:160-197`) | Un mobile qui reconnecte son WS ne reçoit plus jamais d'offre ni de `kicked` | Comparer le pointeur, limites et deadlines, fermer à la fin |
| R7 | H | Fuites dans `HandleWebRTC` : place consommée et live passé « live » avant validation du SDP ; PC jamais fermé sur les retours d'erreur ; aucune limite de taille/nombre de PC par utilisateur ; ~50 PC max sans mux UDP (`2311-2354`, `1221-1254`) | Boucle de POST `/webrtc` = épuisement des ports média de toutes les rooms ; mauvaise `WEBRTC_PORT_*` = ICE muet | Valider d'abord, fermer le PC sur erreur, `MaxBytes`, mux UDP, échouer vite sur config invalide |
| R8 | M | Hôte parti mais invité présent : la room ne se termine que si `Connections == 0` ; live « live », FFmpeg sans entrée (`2110-2128`) | Flux gelé indéfiniment | Timer « hôte absent » ~60 s |
| R9 | M | Toute piste hôte devient source HLS (deux caméras = RTP entrelacé corrompu) ; `tryStartHLS` exige ≥ 2 pistes : hôte sans micro = pas de HLS (`2223-2252`, `1370`) | Replay/HLS absents ou corrompus | Choisir une piste audio + une vidéo ; démarrer en vidéo seule |
| R10 | M | Porte PLI : `%150 == 0` sur des millisecondes, quasi jamais vrai — **vérifié** `room.go:1753` ; rafales PLI/FIR par join sans debounce (`1445-1460`, `1328-1358`) | Démarrage HLS lent (s'ouvre au timeout 2 s) ; qualité qui chute quand des gens rejoignent | Ticker/horodatage, 1 demande/s/SSRC |
| R11 | M | Aucun intercepteur Pion (NACK, TWCC, REMB, RR) — **vérifié** | Gels vidéo sur réseau mobile avec pertes, aucune adaptation au débit | `RegisterDefaultInterceptors` |
| R12 | M | Goroutines relais/RTCP/renégociation sans `recover` | Un bug de parsing H264/STAP-A/VP8 tue le serveur | Wrapper `safeGo` |
| R13 | B | Attente `GatheringComplete` sans timeout (~5 s par offre si STUN bloqué) ; dance de mutex dans `requestRenegotiationOffer` ; room obsolète après teardown ; rooms planifiées jamais démarrées jamais purgées | — | Timeout/NAT1To1, verrou par room, janitor |

### Autorisation et validation
| ID | Sév. | Constat | Correctif |
|---|---|---|---|
| A1 | H | `ensureParticipant` ajoute n'importe quel utilisateur connecté (pas de réservation, d'approbation, ni de contrôle du statut de la room) ; la réservation est ouverte à tous (`1196-1217`, `605-657`) | Autoriser seulement hôte ou réservés, statut `scheduled/live` |
| A2 | H | Limite de places incohérente (`ReserveRoom` autorise 5 hors hôte, `ensureParticipant` compte l'hôte → 6 vs 5 ; `5` en dur à ~6 endroits) ; lecture-modification-écriture sans verrou (`619-645` vs `1206`) | Une constante, allocation atomique (transaction / table de jointure avec index unique) |
| A3 | M | `HandleICECandidate` et `PollRenegotiationOffer` n'exigent pas d'être participant ; ICE en attente sans plafond ni TTL | Exiger un PC/participant, plafonner (~50) |
| A4 | M | Aucun `MaxBytesReader`, aucun rate limit, `http.Server` sans timeouts (slowloris) | Middleware de taille, limiteur IP/utilisateur, `http.Server` configuré |
| A5 | M | `CreateNewRoom` : pas de limites de longueur/format, `Status` libre (peut créer un live « live » ou « ended » sans flux), `scheduledAt` passé accepté, `DurationMinutes` négatif/énorme, tags illimités, `ThumbnailURL` libre, Room/Live/Tags hors transaction (room orpheline si échec), double `BindJSON` | DTO avec `binding`, statut en liste blanche, transaction |
| A6 | M | 409 : vérification puis insertion non atomique (double clic = deux lives) ; une ligne « live/scheduled » périmée bloque la création à vie ; le 409 ne renvoie pas le `roomId` existant | Index unique partiel `(user_id) WHERE status IN ('live','scheduled')`, expiration, renvoyer le `roomId` |
| A7 | M | `KickParticipant` : correspondance `strings.Contains` bidirectionnelle sur le stream id, 200 sans cible, `KickedUsers` en mémoire uniquement, utilisateur expulsé pouvant re-réserver, WS non fermé | Correspondance exacte, 404, persistance |
| A8 | M | `AddParticipant` jamais enregistré (code mort permettant d'ajouter n'importe quel `userId`) | Supprimer ou restreindre à l'hôte |
| A9 | M | `?token=` accepté sur toutes les routes `/api` (et cookies `token`/`auth_token`) ; le logger gin écrit la query string → JWT dans les logs | `?token` uniquement sur le WS (idéalement ticket court), pas de cookie sur les routes mutantes |
| A10 | B | `jwt` sans `WithValidMethods`; lecture BDD à chaque requête (dont le polling à 1,2 s) ; CORS `*` + `localhost` toujours autorisé ; `err.Error()` renvoyé aux clients ; SDP complet et candidats ICE (IP clients) logués en INFO ; `HandleDisconnect` renvoie 200 même si la room est introuvable et fait perdre la réservation ; `DELETE /lives/:id` ne coupe pas la room/FFmpeg active | Corrections ponctuelles (S) |

### ICE, codecs, réseau
| ID | Sév. | Constat | Correctif |
|---|---|---|---|
| N1 | H | Pas de TURN, pas de mux ICE-TCP serveur : échec total si UDP bloqué | coturn (UDP/TCP/TLS 443) + identifiants courts via l'API + `SetICETCPMux` |
| N2 | H | `WEBRTC_IP` retombe silencieusement sur `127.0.0.1` | Refuser de démarrer (ou alerter fort) hors mode dev |
| N3 | M | 101 ports UDP publiés via docker-proxy (lent) ; capacité réelle ~50 PC | Mux UDP unique, `network_mode: host` ou plage réduite |
| N4 | M | Aucune politique de codec : un publieur VP8/VP9 reçoit un live « live » sans HLS ni replay ; `resolveCodec` retombe sur PT 0 (piste liée à rien) ; profils H264 mixtes non filtrés | MediaEngine restreint à Opus + H264 `42e01f`, rejet visible sans codec commun |
| N5 | B | Audio non filtré par PT vers FFmpeg (CN, DTMF) ; `level-asymmetry-allowed` ignoré | Filtrer |

## 2. Backend — HLS, FFmpeg, replays, cycle de vie du live

| ID | Sév. | Constat | Correctif |
|---|---|---|---|
| H1 | C | Voir R3 : `StopStream` sous mutex global, avec copie récursive des 4 renditions (~8 Go pour 2 h) | `os.Rename` vers `storage/replays` (copie en repli inter-disque), tout en goroutine |
| H2 | C | Voir R1/R8 : pas de réconciliation au démarrage ; lives « live » éternels ; dossiers HLS jamais nettoyés ; rooms planifiées jamais purgées | Au boot : clôturer les lives périmés, générer le replay des dossiers HLS restants, janitor périodique |
| H3 | H | FFmpeg non supervisé : `cmd.Wait()` seulement à l'arrêt ; crash silencieux, playlist figée, pas de redémarrage ; `tryStartHLS` non retenté ; pas de `Pdeathsig` | Goroutine d'attente, redémarrage avec backoff (`append_list`), journaliser la fin de stderr, `SIGTERM` |
| H4 | H | 4 encodages x264 par live (1080p toujours produit même pour une source 480p/720p, AAC encodé 4 fois), aucun plafond de lives simultanés, aucune limite CPU, dans le même conteneur que l'API et le SFU | Échelle selon la source, dropper 1080p, audio une fois, sémaphore, limites compose, worker séparé |
| H5 | H | Vidéo portrait (téléphone) letterboxée en 16:9 (`pad=1920:1080`) dans toutes les renditions et le replay | Calculer la taille depuis le ratio source (`scale=-2:720`), supprimer le pad |
| H6 | H | Playlist EVENT illimitée (`hls_list_size 0`, pas de `delete_segments`) : chaque spectateur retélécharge toute la playlist (~300 Ko / 2 s sur 3 h) ; iOS natif démarre au début ; aucune rétention des dossiers/replays | Fenêtre glissante pour le live, replay depuis un enregistrement séparé, `EXT-X-START`, janitor + rétention |
| H7 | H | Replay : échec de génération = source supprimée ; durée jamais mesurée ; pas de miniature/`preview_gif` générée ; lives plus courts que le 1er segment sans replay ; anciens `.mp4` persistants | Supprimer la source seulement après succès vérifié, mesurer la durée, miniature par FFmpeg |
| H8 | H | Aucun volume pour `./hls`, `./storage/replays`, `./storage/uploads` — **vérifié** ; 139 fichiers média dans git — **vérifié** (dont 72 Mo de replays) ; pas de `restart`/healthcheck/limites pour `backend` — **vérifié** | Volumes nommés, `restart: unless-stopped`, healthcheck, `.gitignore` + `git rm --cached` |
| H9 | H | `view_count`, `current_viewers`, `replay_views`, `Room.Viewers` jamais incrémentés (les spectateurs HLS sont des requêtes statiques) : tri « vues/spectateurs » et badges toujours à 0 | Heartbeat spectateur (TTL), vues uniques, `replay_views` au démarrage du replay |
| H10 | H | `r.Static` sur `./hls` et `./storage/replays` : types MIME `.m3u8`/`.ts` probablement faux sur Alpine (sans `mime.types`), aucun `Cache-Control` (*non vérifié à l'exécution*) | Middleware Content-Type + `no-cache` playlists / `immutable` segments ; `apk add mailcap` ; servir via nginx/CDN |
| H11 | M | Boucle de retry UDP morte (`net.Dial("udp4")` n'échoue jamais) ; relais écrit avant que FFmpeg ne soit lié (1res IDR perdue) ; remplace le « hack 500 ms » | Attendre la liaison / premier segment, tamponner la 1re keyframe |
| H12 | M | Allocation de port FFmpeg : TOCTOU, plage éphémère chevauchant 50000-50100 | Plage dédiée hors ICE + allocateur |
| H13 | M | Synchro A/V : `use_wallclock_as_timestamps`, pas de RTCP SR transmis | Transmettre les SR ou petit jitter buffer (*dérive non mesurée*) |
| H14 | M | Seul l'hôte est dans le HLS/replay : les co-streamers (jusqu'à 5) ne sont jamais visibles ni audibles côté spectateurs HLS | Compositeur/mixeur (L) ou documenter la limite |
| H15 | M | VP8 / hôte sans micro : pas de HLS, le live reste « live » | Transcoder, démarrer en vidéo seule, exposer « HLS indisponible » |
| H16 | M | Reconnexion hôte pendant un live : `seqNum` remis à 0 et timestamps rebasés sur le même `HLSWriter` | Offset continu par writer (*effet non vérifié*) |
| H17 | M | `DeleteLive` pendant un live : ne coupe ni FFmpeg ni room ; le replay est quand même copié vers un dossier orphelin | Refuser si non `ended` ou démonter d'abord |
| H18 | M | `liveStatus` accepté du client ; vérif-puis-création non atomique ; `Visibility` jamais appliquée (tout est public, URLs permanentes) ; `CountryID`/`DishID` jamais renseignés (catégories toujours vides) | Voir A5/A6 ; décider du besoin de lives privés |
| H19 | M | Les DTO de live publics embarquent `followersIds`/`followingIds` de l'hôte (jusqu'à des milliers d'ID par carte, accès anonyme) | DTO résumé (id, pseudo, avatar, compteurs) |
| H20 | M | Upload : type MIME fait confiance au client, pas de `MaxBytesReader`, pas de quota/rate limit, pas de contrôle des magic bytes | `MaxBytes`, `DetectContentType`, quota |
| H21 | M | `GetLives` : tri `COALESCE(scheduled_at, created_at) ASC` pour tous les statuts (replays du plus ancien au plus récent), sans tie-breaker (pagination qui duplique/saute) ; `ILIKE '%q%'` non échappé ; `GetDiscover` sans cache | Tri par statut, `id` en tie-breaker, échappement, cache |
| H22 | B | `#EXT-X-ENDLIST` ajouté au `master.m3u8` (invalide) ; goroutine de log toutes les 2 s par live (fuite si redémarrage < 2 s) ; `stream.sdp` servi publiquement et copié dans chaque replay ; master écrit avant les variantes ; `room_id` non unique ; index composites manquants ; `Dockerfile` mono-étage, root, sans HEALTHCHECK ni init (zombies FFmpeg) | Corrections ponctuelles (S) |

## 3. Clients mobile et web

### Mobile — diffusion
| ID | Sév. | Constat | Correctif |
|---|---|---|---|
| M1 | C | Aucune reprise réseau : pas de NetInfo, pas de `restartIce()` ; la grâce client de 8 s (`useWebRTC.ts:498-514`) est plus longue que celle du serveur (~5 s), donc inutile ; « Réessayer » crée une nouvelle room (replay coupé en deux) | Backend : grâce 20-30 s + accepter un re-POST de l'utilisateur ; client : NetInfo + re-publication avec backoff (L) ; à minima, message clair « live terminé » |
| M2 | C | Pas de maintien en arrière-plan (voir priorité 5) ; `track.enabled=false` envoie des images noires, le micro est coupé par l'OS | `expo-keep-awake` (`useKeepAwake`), service de premier plan caméra+micro, `POST_NOTIFICATIONS`, plugin `@config-plugins/react-native-webrtc`, `UIBackgroundModes` |
| M3 | H | Écran hôte sans chat, sans compteur de spectateurs, sans kick ; aucun `kickParticipant` côté mobile | `ChatPanel` repliable + compteur + action par participant |
| M4 | H | Un seul flux distant affiché (PiP 120×90) sur 5 co-streamers, choisi arbitrairement | Grille de 6 tuiles ou swap au toucher, libellés |
| M5 | H | Tuiles distantes périmées : pas de timer sur `mute`, `ended` non filtré, repli sur `remoteStreams[0]` (le web a un timeout de 5 s) | Timer 5 s sur `mute`, `onremovetrack`, filtrer les pistes `ended` |
| M6 | H | Perte de capture locale non détectée (pas d'`ended` sur les pistes locales) : pastille LIVE affichée alors que la caméra est prise par un autre app/appel | Écouter `ended`/`mute`, bannière + ré-acquisition (`replaceTrack`) |
| M7 | H | `roomId` non persisté : après crash/réseau coupé, `disconnect` échoue en silence et le prochain live donne 409 sans issue (« reprendre » / « terminer ») | Persister le `roomId`, retenter au lancement, proposer reprise/fin sur 409, Studio doit contrôler aussi les lives actifs |
| M8 | H | Tous les candidats ICE (TCP, IPv6) envoyés un par un en `await` ; le web filtre l'UDP ; le backend répond 500 aux candidats non supportés | Filtrer l'UDP comme le web, envoyer en parallèle |
| M9 | H | Config de prod : `apiBaseUrl` retombe sur `http://localhost:8081/api`, `eas.json` sans `env` ; en production tout échoue (HLS et replays inclus) | `env` par profil EAS, échec de build si absent/non https |
| M10 | M | Pas de gestion de session audio (route haut-parleur/écouteur/Bluetooth, mode non remis après `stopLive`) | Couche de routage audio, réinitialiser à la libération |
| M11 | M | `inactive` désactive la vidéo (Centre de contrôle iOS = écran noir inutile) ; réactive même si l'utilisateur avait changé de caméra | Réagir à `background` seulement, état « en pause » |
| M12 | M | Polling de renégociation toutes les 1,2 s (~50 req/min), sans vérifier `signalingState`, sans rollback si `createAnswer` échoue, sans backoff sur 401/404 ; le canal WebSocket (qui seul envoie `kicked`) n'est pas utilisé | WebSocket en priorité, polling 3-5 s avec backoff en repli, rollback |
| M13 | M | Contraintes fixes 1280×720@30 face avant, pas de plafond de débit ni de `degradationPreference`, pas de flags audio (le web : 854×480@24 avec echo/noise/AGC) | 640×360-960×540, ~1,2-1,5 Mbps, flags audio, caméra arrière par défaut en cuisine |
| M14 | M | Manipulation SDP : suppression des autres codecs vidéo par regex ; risque de profil H264 non transférable ; le SDP posté n'est pas comparé à `localDescription` | `setCodecPreferences` (comme le web) |
| M15 | B | STUN seul (pas de TURN) → seul retour « 8 s de grâce » ; erreurs ICE avalées (`drainIceQueue`) ; `getRenderableStreams` recrée un tableau à chaque `mute` (re-rendu de tout l'écran) | Voir N1 ; compteur d'échecs ; mémoïser |
| M16 | B | Aucune interruption iOS/Android gérée explicitement (appel entrant, Siri) | Détecter et informer |

### Mobile — spectateur, replays, chat
| ID | Sév. | Constat | Correctif |
|---|---|---|---|
| P1 | H | Lecture HLS native : playlist EVENT, pas de `targetOffsetFromLive`, pas de bouton « Direct », le chien de garde n'est pas réarmé après `readyToPlay` (un gel sans erreur n'est jamais rechargé) | Fenêtre côté backend (H6), `targetOffsetFromLive`, bouton « Direct », surveiller `isLive`/buffering, recharger après 10 s de gel |
| P2 | M | Pas de lecture arrière-plan / PiP / `expo-video` plugin configuré ; `orientation: portrait` dans `app.json` et le manifest rend le layout paysage inaccessible sur téléphone ; le lecteur change de position dans l'arbre selon l'orientation (remontage sur iPad) | Décider explicitement, autoriser le paysage sur l'écran du live, position stable |
| P3 | M | Onglet Rediffusions sans filtre `has_replay` : cartes menant à « replay en préparation » | `filter: (l) => l.has_replay \|\| l.replay_url` |
| P4 | B | Pas de reprise de position, de vitesse, de choix de qualité sur natif (parité avec le web) | — |
| P5 | B | Web (`HLSPlayer.web`) : `lowLatencyMode` + buffer 6 s contre des segments de 2 s sans LL-HLS → rebuffering ; le player `front-web` utilise une autre config ; `StreamView.web` force `muted` | Une seule config |
| C1 | M | Chat : chaque sondage (5 s) remplace tout le tableau (re-rendu complet), pas de `since`, pas de plafond de lignes, sondage actif onglet masqué, pas de garde de séquence (une vieille réponse écrase une récente), pas de garde « requête déjà en vol » (`usePolling`) | Comparer le dernier id, `?after=`, plafonner ~200 lignes, garde de séquence |
| C2 | M | Dédoublonnage des messages en attente par texte seul ; pas de rate limit client ni de modération/signalement | Identifiant client si le backend l'accepte |
| C3 | B | Chat chargé seulement si connecté (peut être voulu) ; la page hôte web interroge `/rooms` (liste complète) toutes les 3 s pour trouver une room | `/rooms/:id` |

### Web (`front-web`)
| ID | Sév. | Constat | Correctif |
|---|---|---|---|
| B1 | H | Page replay : changer la qualité détruit hls.js, remet « Auto » et redémarre à 0 (`selectedQuality` et `t` dans les dépendances de l'effet, `replays/[id]/page.tsx:98-229`) | Retirer les deux des dépendances, appliquer la qualité via `applyQuality` |
| B2 | H | Hôte web : en cas d'erreur, caméra/micro/PC restent ouverts et la room créée est orpheline ; `disconnected` sans nettoyage ni `disconnectRoom` | Faire passer les échecs par le même nettoyage que `stopLive` |
| B3 | M | `recoverMediaError()` sans plafond (boucle), erreurs réseau non retentées sur la page replay ; `<track kind="captions">` vide | Politique bornée (cf. `playerRetry.ts` mobile) |
| B4 | M | JWT dans l'URL du WebSocket (`?token=`) ; `console.log("[ICE] request body")` en production | Ticket court, retirer le log |
| B5 | B | `setTimeout(playVideo, 1200)` non nettoyé (page watch) ; `createRoom` web n'envoie que `{name}` et affiche « Failed to create room (409) » brut | — |

## 4. Tests : ce qui n'est pas couvert

- **Backend** : `room_test.go` = 3 tests triviaux ; rien sur les handlers, la machine d'états, la concurrence (`-race`), les 409, la reconnexion, la grâce de déconnexion, le kick, les endpoints ICE/answer, le WebSocket, les codecs, les parseurs STAP-A/FU-A/VP8 (à fuzzer), le middleware d'auth (token en query/cookie), la réconciliation au démarrage. **Aucun test** pour `internal/hls`, `modules/live`, `discover`, `upload`. Manquent : FFmpeg factice (crash/arrêt), replay depuis un dossier fixture, MIME/cache HLS, charge (CPU par live), test d'intégration à deux clients Pion.
- **Mobile** : `live-streaming.test.tsx` mocke tout le hook et `StreamView` ; `useWebRTC.test.ts` mocke le PeerConnection, donc ne peut pas révéler M1, M8, M12 ni les vrais événements `ended`/`mute` de react-native-webrtc. Non couverts : transitions `AppState` du hook, `preferH264` sur de vrais SDP, changement de réseau, permission révoquée en live, flux distant retiré, 409 côté UI, échec de renégociation, gel du lecteur, filtre des rediffusions. Les comportements purement natifs (service de premier plan, routage audio, interruptions iOS, Bluetooth) exigent une **checklist manuelle sur appareil**.
- **Web** : aucun test des hooks/pages du périmètre ; aucun test de bout en bout (publication → HLS, reprise après crash hôte).

## 5. Ce qui est bien fait

Secret JWT obligatoire ; identité toujours tirée du JWT (jamais du corps) pour la signalisation ; contrôles hôte-seulement corrects (kick, fin de room, suppression de live sans IDOR) ; statut de ban relu en base à chaque requête ; conception SFU `TrackLocalStaticRTP` par pair ; coalescence de la renégociation ; `onPeerDisconnected` idempotent ; porte SPS/PPS + PLI avant FFmpeg et gestion STAP-A ; arrêt FFmpeg gracieux avec repli kill ; pas de path traversal détecté (UUID partout) ; uploads en UUID avec liste blanche d'extensions ; `SetTrustedProxies(nil)` et `CheckOrigin` du WS corrects. Côté mobile : annulation de session et nettoyage de `useWebRTC` solides, file ICE correcte, `http.ts` (401/ban, timeouts, encodage), navigation protégée pendant un live, retries bornés du lecteur, gardes de réponses périmées dans `useLiveRoom`/`useLivesFeed`.

## 6. Avancement

### Phase 1 — correctifs rapides : FAITE
- [x] **R2** verrou sur la carte `liveRooms` (mutex feuille, `peekLiveRoom`/`setLiveRoom`), lecture des rooms du WebSocket sous `mu`, `ensureParticipant` atomique. *Reste* : `go test -race` complet des handlers (il passe sur les paquets touchés).
- [x] **R6** désenregistrement WebSocket par pointeur ; ajout de `SetReadLimit`, ping/pong avec deadline, deadline d'écriture, fermeture si l'écriture échoue.
- [x] **H7** le replay est maintenant **déplacé** (`os.Rename`, instantané) avec copie en repli ; la source n'est supprimée qu'après succès (ou s'il n'y a rien à garder, `ErrNoReplayContent`) ; plus de replay à moitié copié.
- [x] **H22 (partiel)** plus de `#EXT-X-ENDLIST` dans `master.m3u8`.
- [x] **R10 (partiel)** porte PLI basée sur le temps (le test `%150` ne se déclenchait quasiment jamais). *Reste* : debounce des rafales PLI/FIR.
- [x] **N2** avertissement explicite quand `WEBRTC_IP` est une adresse loopback (pas de refus de démarrer : le défaut `127.0.0.1` est valide pour un navigateur sur la même machine).
- [x] **H10** `middleware.MediaHeaders` : Content-Type `.m3u8`/`.ts`/`.mp4` et `Cache-Control` (playlist live jamais en cache, segments et replays longuement) ; `mailcap` ajouté à l'image.
- [x] **H8** volume `backend_data` unique (`/foodstream/data`, liens `hls` et `storage` pour que le déplacement reste un simple rename), `restart: unless-stopped`, `HEALTHCHECK`, `backend/.dockerignore`, médias retirés du suivi git (`git rm --cached`, fichiers conservés sur disque) et ajoutés au `.gitignore`. *Image construite et vérifiée ; le conteneur en cours n'a PAS été recréé.*
- [x] **M8** mobile : seuls les candidats ICE UDP sont envoyés (comme le web).
- [x] **P3** mobile : l'onglet Rediffusions ne liste que les lives avec enregistrement.
- [x] **M9 (partiel)** mobile : plus de repli silencieux sur `localhost` en build de production (erreur explicite). *Reste* : définir `EXPO_PUBLIC_API_BASE_URL` (https) dans les profils EAS.
- [x] **B1** web : changer la qualité d'un replay ne détruit plus hls.js ni ne remet à zéro ; **B3 (partiel)** récupération d'erreur média plafonnée à 3.

### À faire ensuite
- Phase 2 (fiabilité du live) : R1/M1 grâce de déconnexion + re-POST, H2/R8 réconciliation au démarrage + timer hôte absent, R3/H1 `StopStream` hors verrou (la copie ne bloque plus, mais le sleep et l'arrêt FFmpeg restent sous le mutex), H3 supervision FFmpeg, R4 un PC par utilisateur.
- Phases 3 à 5 : voir ci-dessous.

## 7. Ordre d'exécution conseillé

1. **Correctifs rapides (S, forte valeur)** : volumes + `restart` + healthcheck + `.gitignore` des médias (H8) ; verrou sur `liveRooms` et `ensureParticipant` (R2) ; ne supprimer la source qu'après un replay réussi (H7) ; filtre UDP et bug `selectedQuality` (M8, B1) ; `unregisterWSConnection` par pointeur (R6) ; `WEBRTC_IP` loopback bloquant (N2) ; filtre `has_replay` (P3) ; `env` EAS (M9) ; porte PLI (R10) ; MIME/cache HLS (H10).
2. **Fiabilité du live (M)** : grâce de déconnexion et re-POST (R1/M1) ; réconciliation au démarrage + timer hôte absent (H2, R8) ; `StopStream` hors verrou + `os.Rename` (R3/H1) ; supervision FFmpeg (H3) ; un PC par utilisateur et ré-attache hôte (R4).
3. **Autorisation et robustesse (M)** : droits de rejoindre et places atomiques (A1, A2) ; limites de taille/débit et `http.Server` (A4) ; validation de création et index unique partiel (A5, A6) ; ticket WS (A9) ; intercepteurs Pion (R11).
4. **Mobile diffusion (M-L)** : keep-awake + service de premier plan (M2) ; reprise réseau (M1) ; chat/compteur/kick hôte (M3) ; grille multi-flux (M4, M5) ; persistance du `roomId` (M7) ; audio (M10).
5. **Échelle et qualité vidéo (M-L)** : TURN (N1) ; échelle d'encodage et portrait (H4, H5) ; fenêtre HLS (H6) ; compteurs de spectateurs (H9) ; compositeur co-streamers (H14).
