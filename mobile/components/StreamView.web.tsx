/**
 * Web implementation of StreamView — renders a <video> element with srcObject.
 * On web, MediaStream doesn't have .toURL(), so we attach the stream directly.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

interface StreamViewProps {
    readonly stream: MediaStream | null;
    readonly style?: ViewStyle;
    readonly objectFit?: 'cover' | 'contain';
    readonly mirror?: boolean;
}

export default function StreamView({ stream, style, objectFit = 'cover', mirror = false }: Readonly<StreamViewProps>) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    if (!stream) {
        return null;
    }

    return (
        <View style={[styles.container, style]}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit,
                    borderRadius: 16,
                    transform: mirror ? 'scaleX(-1)' : undefined,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 16,
        backgroundColor: '#000',
    },
});
