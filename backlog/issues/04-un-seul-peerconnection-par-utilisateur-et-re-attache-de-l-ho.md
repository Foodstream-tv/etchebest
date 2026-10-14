# Un seul PeerConnection par utilisateur et ré-attache de l'hôte au HLS

> Source : `AUDIT_LIVE_WEBRTC.md` — constats R4, H16

## Problème
`registerPeer` ajoute un second PC pour le même utilisateur sans fermer l'ancien : ICE et answers vont au PC périmé ; à la mort de l'ancien, l'état du nouveau est effacé. Après un rechargement de page de l'hôte, `HostPeerCon` pointe sur l'ancien PC, le nouveau n'est jamais source HLS : HLS et replay s'arrêtent. Reconnexion hôte : `seqNum`/timestamps remis à zéro sur le même writer.

## Correctif proposé
Clé de connexion par userID (fermer/remplacer), ne nettoyer que si le PC sortant est le courant, ré-attache de l'hôte comme source HLS, offsets continus de séquence/timestamp par writer.

## Critères d'acceptation
- [ ] Recharger la page hôte pendant un live conserve HLS et replay
- [ ] Les ICE/answers ciblent toujours le PC courant
- [ ] Tests de reconnexion du même utilisateur

## Fichiers concernés
- `backend/internal/modules/room/room.go`
