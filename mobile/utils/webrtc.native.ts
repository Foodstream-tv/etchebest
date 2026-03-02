/**
 * Native (iOS/Android) WebRTC — direct re-export from react-native-webrtc.
 * Metro will pick this file on native builds thanks to the .native.ts extension.
 */
export {
    MediaStream, RTCIceCandidate, RTCPeerConnection,
    RTCSessionDescription, RTCView, mediaDevices
} from 'react-native-webrtc';

export const isNativeWebRTC = true;
