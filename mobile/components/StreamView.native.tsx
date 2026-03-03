/**
 * Native implementation of StreamView — renders RTCView from react-native-webrtc.
 * On native, MediaStream has .toURL() which RTCView needs as streamURL.
 * Falls back gracefully when the native module is not available (e.g. Expo Go).
 */
import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';

interface StreamViewProps {
    readonly stream: MediaStream | null;
    readonly style?: ViewStyle;
    readonly objectFit?: 'cover' | 'contain';
    readonly mirror?: boolean;
}

let RTCView: React.ComponentType<{
    streamURL: string;
    style?: ViewStyle;
    objectFit?: 'cover' | 'contain';
    mirror?: boolean;
}> | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RTCView = require('react-native-webrtc').RTCView;
} catch {
    RTCView = null;
}

export default function StreamView({ stream, style, objectFit = 'cover', mirror = false }: Readonly<StreamViewProps>) {
    if (!RTCView) {
        return (
            <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }, style]}>
                <Text style={{ color: '#fff', fontSize: 14 }}>WebRTC non disponible dans Expo Go</Text>
            </View>
        );
    }

    if (!stream) {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamURL = (stream as any).toURL?.() ?? null;

    if (!streamURL) {
        return null;
    }

    return (
        <RTCView
            streamURL={streamURL}
            style={style}
            objectFit={objectFit}
            mirror={mirror}
            zOrder={0}
        />
    );
}
