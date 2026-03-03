import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import StreamView from '../components/StreamView';
import { StreamingState, useWebRTC } from '../hooks/useWebRTC';

const ORANGE_GRADIENT = ['#FFA92E', '#FF5D1E'] as const;

function StatusBadge({ state }: Readonly<{ state: StreamingState }>) {
    const labels: Record<StreamingState, string> = {
        idle: 'Prêt',
        creating: 'Création…',
        connecting: 'Connexion…',
        live: '🔴 EN DIRECT',
        error: 'Erreur',
        disconnected: 'Déconnecté',
    };
    const colors: Record<StreamingState, string> = {
        idle: '#888',
        creating: '#FFA92E',
        connecting: '#FFA92E',
        live: '#FF3B30',
        error: '#FF3B30',
        disconnected: '#888',
    };
    return (
        <View style={[styles.badge, { backgroundColor: colors[state] + '20', borderColor: colors[state] }]}>
            <Text style={[styles.badgeText, { color: colors[state] }]}>{labels[state]}</Text>
        </View>
    );
}

function getPlaceholderText(state: StreamingState): string {
    if (state === 'creating') return 'Création de la salle…';
    if (state === 'connecting') return 'Connexion en cours…';
    return 'Caméra non active';
}

function PlaceholderVideo({ state }: Readonly<{ state: StreamingState }>) {
    const isLoading = state === 'creating' || state === 'connecting';
    return (
        <View style={styles.placeholderVideo}>
            {isLoading ? (
                <ActivityIndicator size="large" color="#FF7A00" />
            ) : (
                <Ionicons name="videocam-outline" size={64} color="#ccc" />
            )}
            <Text style={styles.placeholderText}>{getPlaceholderText(state)}</Text>
        </View>
    );
}

function StreamControls({
    hasStarted,
    isHost,
    state,
    onStart,
    onStop,
    onRetry,
}: Readonly<{
    hasStarted: boolean;
    isHost: boolean;
    state: StreamingState;
    onStart: () => void;
    onStop: () => void;
    onRetry: () => void;
}>) {
    if (!hasStarted && isHost) {
        return (
            <TouchableOpacity onPress={onStart} activeOpacity={0.85}>
                <LinearGradient
                    colors={ORANGE_GRADIENT}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.goLiveButton}
                >
                    <Ionicons name="radio-outline" size={20} color="#fff" />
                    <Text style={styles.goLiveText}>Lancer le live</Text>
                </LinearGradient>
            </TouchableOpacity>
        );
    }
    if (state === 'live' || state === 'connecting') {
        return (
            <TouchableOpacity onPress={onStop} style={styles.stopButton}>
                <Ionicons name="stop-circle-outline" size={20} color="#fff" />
                <Text style={styles.stopText}>Arrêter</Text>
            </TouchableOpacity>
        );
    }
    if (state === 'error' || state === 'disconnected') {
        return (
            <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
                <Ionicons name="refresh-outline" size={20} color="#FF7A00" />
                <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
        );
    }
    return null;
} export default function LiveStreamingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ roomId?: string; mode?: string }>();
    const isHost = params.mode !== 'join';
    const targetRoomId = params.roomId;

    const {
        state,
        roomId,
        localStream,
        remoteStreams,
        error,
        startLive,
        joinAsCoStreamer,
        stopLive,
    } = useWebRTC();

    const [hasStarted, setHasStarted] = useState(false);

    // Auto-join if joining existing room as co-streamer
    useEffect(() => {
        if (!isHost && targetRoomId && !hasStarted) {
            setHasStarted(true);
            joinAsCoStreamer(targetRoomId);
        }
    }, [isHost, targetRoomId, hasStarted, joinAsCoStreamer]);

    const handleStartLive = useCallback(async () => {
        setHasStarted(true);
        await startLive('Live Stream');
    }, [startLive]);

    const handleStopLive = useCallback(async () => {
        await stopLive();
        router.back();
    }, [stopLive, router]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleStopLive} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <StatusBadge state={state} />
                {!!roomId && (
                    <Text style={styles.roomIdText} numberOfLines={1}>
                        Room: {roomId.slice(0, 8)}…
                    </Text>
                )}
            </View>

            {/* Video area */}
            <View style={styles.videoContainer}>
                {localStream ? (
                    <StreamView
                        stream={localStream as unknown as MediaStream}
                        style={styles.localVideo}
                        objectFit="cover"
                        mirror={true}
                    />
                ) : (
                    <PlaceholderVideo state={state} />
                )}

                {/* Remote streams (co-streamers) */}
                {remoteStreams.length > 0 && (
                    <View style={styles.remoteContainer}>
                        {remoteStreams.map((stream) => (
                            <StreamView
                                key={(stream as any).id}
                                stream={stream as unknown as MediaStream}
                                style={styles.remoteVideo}
                                objectFit="cover"
                            />
                        ))}
                    </View>
                )}
            </View>

            {/* Error display */}
            {!!error && (
                <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={18} color="#FF3B30" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
                <StreamControls
                    hasStarted={hasStarted}
                    isHost={isHost}
                    state={state}
                    onStart={handleStartLive}
                    onStop={handleStopLive}
                    onRetry={() => {
                        setHasStarted(false);
                        stopLive();
                    }}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    roomIdText: {
        color: '#aaa',
        fontSize: 12,
        flex: 1,
        textAlign: 'right',
    },
    videoContainer: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        margin: 12,
    },
    localVideo: {
        flex: 1,
        borderRadius: 16,
    },
    placeholderVideo: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    placeholderText: {
        color: '#888',
        fontSize: 14,
    },
    remoteContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
        gap: 8,
    },
    remoteVideo: {
        width: 120,
        height: 90,
        borderRadius: 12,
        backgroundColor: '#333',
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 10,
        backgroundColor: 'rgba(255,59,48,0.1)',
        borderRadius: 10,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 13,
        flex: 1,
    },
    controls: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        alignItems: 'center',
    },
    goLiveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
        minWidth: 200,
    },
    goLiveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FF3B30',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
        minWidth: 200,
        justifyContent: 'center',
    },
    stopText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#FF7A00',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 16,
        minWidth: 200,
        justifyContent: 'center',
    },
    retryText: {
        color: '#FF7A00',
        fontSize: 16,
        fontWeight: '700',
    },
});
