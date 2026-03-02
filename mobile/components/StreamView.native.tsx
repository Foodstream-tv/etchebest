/**
 * Native implementation of StreamView — renders RTCView from react-native-webrtc.
 * On native, MediaStream has .toURL() which RTCView needs as streamURL.
 */
import React from 'react';
import { type ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';

interface StreamViewProps {
    readonly stream: MediaStream | null;
    readonly style?: ViewStyle;
    readonly objectFit?: 'cover' | 'contain';
    readonly mirror?: boolean;
}

export default function StreamView({ stream, style, objectFit = 'cover', mirror = false }: Readonly<StreamViewProps>) {
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
