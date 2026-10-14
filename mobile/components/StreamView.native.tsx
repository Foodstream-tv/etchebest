/**
 * Native implementation of StreamView — renders RTCView from react-native-webrtc.
 * On native, MediaStream has .toURL() which RTCView needs as streamURL.
 * Falls back gracefully when the native module is not available (e.g. Expo Go).
 */
import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface StreamViewProps {
    readonly stream: MediaStream | null;
    readonly style?: ViewStyle;
    readonly objectFit?: 'cover' | 'contain';
    readonly mirror?: boolean;
    readonly zOrder?: number;
}

let RTCView: React.ComponentType<{
    streamURL: string;
    style?: ViewStyle;
    objectFit?: 'cover' | 'contain';
    mirror?: boolean;
    zOrder?: number;
}> | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RTCView = require('react-native-webrtc').RTCView;
} catch {
    RTCView = null;
}

export default function StreamView({ stream, style, objectFit = 'cover', mirror = false, zOrder = 0 }: Readonly<StreamViewProps>) {
    const { t } = useI18n();
    const { colors } = useTheme();

    // Video surfaces stay black in both themes.
    const fallbackStyle = [
        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.video } as const,
        style,
    ];
    const fallbackTextStyle = { color: '#ffffff', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 } as const;

    if (!RTCView) {
        return (
            <View style={fallbackStyle}>
                <Text style={fallbackTextStyle}>{t('golive.error.unsupported')}</Text>
            </View>
        );
    }

    if (!stream) {
        return null;
    }

    // RTCView expects a valid native stream URL on Android.
     
    const streamURL = (stream as any).toURL?.() ?? null;

    if (!streamURL) {
        return (
            <View style={fallbackStyle}>
                <Text style={fallbackTextStyle}>{t('golive.streamUnavailable')}</Text>
            </View>
        );
    }

    return (
        <RTCView
            streamURL={streamURL}
            style={style}
            objectFit={objectFit}
            mirror={mirror}
            zOrder={zOrder}
        />
    );
}
