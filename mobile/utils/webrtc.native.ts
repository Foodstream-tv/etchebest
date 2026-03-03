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

export const isNativeWebRTC = nativeWebRTC !== null;
