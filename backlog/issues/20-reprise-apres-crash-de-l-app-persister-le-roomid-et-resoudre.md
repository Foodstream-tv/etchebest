# Reprise après crash de l'app : persister le roomId et résoudre le 409

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M7

## Problème
Le `roomId` n'est conservé qu'en mémoire : si le réseau est coupé à l'arrêt, `disconnectRoom` échoue en silence ; au lancement suivant « Lancer le live » donne 409 sans issue. Studio ne contrôle que les lives planifiés.

## Correctif proposé
Persister le `roomId` actif (SecureStore) et retenter `disconnect` au lancement ; sur 409, proposer « reprendre » ou « terminer mon live actif » (le backend renvoie le `roomId` existant) ; faire contrôler à Studio aussi les lives actifs.

## Critères d'acceptation
- [ ] Après un kill de l'app, l'utilisateur peut terminer ou reprendre son live depuis Studio
- [ ] Aucun 409 sans action proposée

## Fichiers concernés
- `mobile/hooks/useWebRTC.ts`
- `mobile/app/(tabs)/studio.tsx`
