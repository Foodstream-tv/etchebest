import { ResizeMode, Video } from 'expo-av';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface HLSPlayerProps {
    uri: string;
    onLoad?: () => void;
    onError?: (err: any) => void;
    style?: any;
}

export default function HLSPlayer({ uri, onLoad, onError, style }: HLSPlayerProps) {
    const videoRef = useRef<Video>(null);
    const [loading, setLoading] = useState(true);

    return (
        <View style={[styles.container, style]}>
            <Video
                ref={videoRef}
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping={false}
                useNativeControls
                onLoad={() => {
                    setLoading(false);
                    onLoad?.();
                }}
                onError={(err) => {
                    console.warn('HLS error:', err);
                    setLoading(false);
                    onError?.(err);
                }}
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
