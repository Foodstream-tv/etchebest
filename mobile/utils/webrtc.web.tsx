/**
 * Web fallback — exposes browser-native WebRTC globals so the app can be
 * imported / bundled on web without pulling in react-native-webrtc
 * (which relies on requireNativeComponent and crashes on web).
 *
 * RTCView is web-incompatible — we export a lightweight <video> wrapper
 * instead, but callers should ideally check `isNativeWebRTC` and use their
 * own web-appropriate rendering.
 */
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

/* ---------- Browser globals ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any */

// These are evaluated at module load time. On the web client they resolve to
// real browser globals. During SSR they may be undefined, but the hook in
// useWebRTC.ts has lazy fallbacks for that case.
export const RTCPeerConnection =
    typeof globalThis !== 'undefined' ? (globalThis as any).RTCPeerConnection : undefined;
export const RTCSessionDescription =
    typeof globalThis !== 'undefined' ? (globalThis as any).RTCSessionDescription : undefined;
export const RTCIceCandidate =
    typeof globalThis !== 'undefined' ? (globalThis as any).RTCIceCandidate : undefined;
export const mediaDevices =
    typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
export const MediaStream =
    typeof globalThis !== 'undefined' ? (globalThis as any).MediaStream : undefined;

/* ---------- RTCView stub for web ---------- */

interface RTCViewProps {
    readonly streamURL: string | null;
    readonly style?: ViewStyle;
    readonly objectFit?: 'cover' | 'contain';
    readonly mirror?: boolean;
    readonly zOrder?: number;
}

/**
 * Minimal placeholder for the native RTCView on web.
 * Real web streaming should use a <video> element with srcObject.
 */
export function RTCView(_props: Readonly<RTCViewProps>) {
    return (
        <View style={[webStyles.container, _props.style]} >
            <Text style={webStyles.text}>
                WebRTC preview is not available on web.
            </Text>
        </View>
    );
}

const webStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
});

export const isNativeWebRTC = false;
