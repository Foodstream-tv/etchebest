import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface HLSPlayerProps {
    uri: string;
    onLoad?: () => void;
    onError?: (err: unknown) => void;
    style?: object;
}

export default function HLSPlayer({ uri, onLoad, onError, style }: Readonly<HLSPlayerProps>) {
    const [loading, setLoading] = useState(true);

    const player = useVideoPlayer({ uri }, p => {
        p.loop = false;
        p.play();
    });

    useEffect(() => {
        const statusSub = player.addListener('statusChange', ({ status, error }) => {
            if (status === 'readyToPlay') {
                setLoading(false);
                onLoad?.();
            } else if (status === 'error') {
                console.warn('HLS error:', error);
                setLoading(false);
                onError?.(error);
            }
        });
        return () => statusSub.remove();
    }, [player, onLoad, onError]);

    return (
        <View style={[styles.container, style]}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls
            />
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FF7A00" />
                    <Text style={styles.loadingText}>Chargement du stream…</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        gap: 12,
    },
    loadingText: {
        color: '#ccc',
        fontSize: 14,
    },
});

