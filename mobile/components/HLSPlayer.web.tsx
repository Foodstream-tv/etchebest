import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface HLSPlayerProps {
    uri: string;
    onLoad?: () => void;
    onError?: (err: any) => void;
    style?: any;
}

export default function HLSPlayer({ uri, onLoad, onError, style }: HLSPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !uri) return;

        const cleanup = () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };

        cleanup();

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                maxBufferLength: 10,
                maxMaxBufferLength: 20,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 6,
            });
            hlsRef.current = hls;

            hls.loadSource(uri);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                setLoading(false);
                setError(null);
                video.play().catch(() => { });
                onLoad?.();
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    console.warn('[HLS.js] Fatal error:', data.type, data.details);
                    setLoading(false);
                    setError(`Stream error: ${data.details}`);
                    onError?.(data);

                    // Try to recover
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        setTimeout(() => hls.startLoad(), 3000);
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = uri;
            video.addEventListener('loadedmetadata', () => {
                setLoading(false);
                setError(null);
                video.play().catch(() => { });
                onLoad?.();
            });
            video.addEventListener('error', () => {
                setLoading(false);
                setError('Failed to load HLS stream');
                onError?.(video.error);
            });
        } else {
            setLoading(false);
            setError('HLS is not supported in this browser');
        }

        return cleanup;
    }, [uri]);

    if (error) {
        return (
            <View style={[styles.container, style]}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, style]}>
            <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                playsInline
                autoPlay
                muted={false}
                controls
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
        justifyContent: 'center',
        alignItems: 'center',
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
    errorText: {
        color: '#FF3B30',
        fontSize: 14,
        textAlign: 'center',
        padding: 20,
    },
});
