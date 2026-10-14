# Contraintes de capture et SDP : résolution/débit adaptés au mobile, setCodecPreferences

> Source : `AUDIT_LIVE_WEBRTC.md` — constats M13, M14

## Problème
Capture fixe 1280×720@30, face avant, sans plafond de débit ni `degradationPreference` ni flags audio (le web : 854×480@24 avec echo/noise/AGC). La manipulation SDP par regex (`preferH264`) peut choisir un profil H264 non transférable, et le SDP posté n'est pas comparé à `localDescription`.

## Correctif proposé
640×360 à 960×540 par défaut, plafond ~1,2-1,5 Mbps via `setParameters`, `maintain-framerate`, flags audio, caméra arrière par défaut pour la cuisine ; `transceiver.setCodecPreferences` à la place de la regex.

## Critères d'acceptation
- [ ] Le débit montant reste ≤ 1,5 Mbps
- [ ] Plus de manipulation SDP par regex, H264 `42e01f` négocié

## Fichiers concernés
- `mobile/hooks/useWebRTC.ts`
- `mobile/utils/webrtcSdp.ts`
