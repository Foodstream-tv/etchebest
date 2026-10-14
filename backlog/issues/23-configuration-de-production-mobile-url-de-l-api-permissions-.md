# Configuration de production mobile : URL de l'API, permissions et textes iOS

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M9

## Problème
`eas.json` ne définit aucun `env` : un build de production sans `EXPO_PUBLIC_API_BASE_URL` n'a pas d'API (le repli `localhost` a été retiré). Le manifest Android déclare `SYSTEM_ALERT_WINDOW`, stockage externe, `VIBRATE`… inutiles pour la release, `allowBackup=true`. Les textes iOS (caméra, micro, Face ID) sont génériques et non localisés.

## Correctif proposé
Définir `EXPO_PUBLIC_API_BASE_URL` (https) par profil EAS, faire échouer le build si absente ou non https en production, `blockedPermissions`, `allowBackup=false`, `InfoPlist.strings` FR/EN.

## Critères d'acceptation
- [ ] Un build preview/production pointe sur la bonne API https
- [ ] Le manifest de release ne contient que les permissions utiles
- [ ] Les demandes de permission iOS sont localisées

## Fichiers concernés
- `mobile/eas.json`
- `mobile/app.json`
- `mobile/android/app/src/main/AndroidManifest.xml`
