/**
 * Native (iOS/Android) WebRTC — direct re-export from react-native-webrtc.
 * Metro will pick this file on native builds thanks to the .native.ts extension.
 * Falls back gracefully when the native module is not compiled (e.g. Expo Go).
 */

let nativeWebRTC: typeof import('react-native-webrtc') | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeWebRTC = require('react-native-webrtc');
} catch {
    nativeWebRTC = null;
}

export const MediaStream = nativeWebRTC?.MediaStream;
export const RTCIceCandidate = nativeWebRTC?.RTCIceCandidate;
export const RTCPeerConnection = nativeWebRTC?.RTCPeerConnection;
export const RTCSessionDescription = nativeWebRTC?.RTCSessionDescription;
export const RTCView = nativeWebRTC?.RTCView;
export const mediaDevices = nativeWebRTC?.mediaDevices;

// Type-namespace aliases — these mirror the instance types from react-native-webrtc
// so that consumers can use them as type annotations (e.g. `useState<MediaStream | null>`)
// without seeing `| undefined` in the type, which would happen if they referenced the
// value-namespace consts above directly as types.
export type MediaStream = import('react-native-webrtc').MediaStream;
export type RTCIceCandidate = import('react-native-webrtc').RTCIceCandidate;
export type RTCPeerConnection = import('react-native-webrtc').RTCPeerConnection;
export type RTCSessionDescription = import('react-native-webrtc').RTCSessionDescription;

export const isNativeWebRTC = nativeWebRTC !== null;
