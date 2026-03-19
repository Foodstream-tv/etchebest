/**
 * Default WebRTC module — the "safe" fallback loaded by Metro's SSR renderer
 * (`node/render.js`) which does NOT use platform extensions like `.web.tsx`.
 *
 * At bundle time Metro resolves:
 *   - webrtc.native.ts  on iOS / Android  (re-exports react-native-webrtc)
 *   - webrtc.web.tsx    on Web client      (browser globals + stub RTCView)
 *
 * This file must NOT import react-native-webrtc because SSR loads it in a
 * Node-like environment where requireNativeComponent does not exist.
 * We export undefined stubs — the real values come from the platform files.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const RTCPeerConnection: any = undefined;
export const RTCSessionDescription: any = undefined;
export const RTCIceCandidate: any = undefined;
export const mediaDevices: any = undefined;
export const MediaStream: any = undefined;
export const RTCView: any = undefined;
export const isNativeWebRTC = false;


