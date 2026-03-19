import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
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

    const primaryRemoteStream =
        remoteStreams.find((stream: any) => {
            const videoTracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
            return videoTracks.some((track: any) => track?.readyState === 'live' && track?.muted === false);
        }) ??
        remoteStreams.find((stream: any) => {
            const videoTracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
            return videoTracks.some((track: any) => track?.readyState === 'live');
        }) ??
        remoteStreams[0] ??
        null;

    const remoteDebugSummary = remoteStreams
        .map((stream: any, index: number) => {
            const tracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
            const trackSummary = tracks
                .map((track: any) => `${track?.id ?? 'no-id'}:${track?.readyState ?? 'na'}:${track?.muted ? 'muted' : 'unmuted'}`)
                .join(',');
            const hasToURL = typeof stream?.toURL === 'function';
            return `#${index + 1} id=${stream?.id ?? 'no-id'} toURL=${hasToURL} tracks=[${trackSummary || 'none'}]`;
        })
        .join(' | ');

    const primaryHasToURL = typeof (primaryRemoteStream as any)?.toURL === 'function';

    const showLocalPip = !!localStream && !(Platform.OS === 'android' && !!primaryRemoteStream);

    const primaryRemoteRenderKey = primaryRemoteStream
        ? `${(primaryRemoteStream as any).id}-${
            ((primaryRemoteStream as any).getVideoTracks?.() || [])
                .map((t: any) => `${t.id}:${t.readyState}:${t.muted}`)
                .join('|')
        }`
        : 'no-remote';

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
                {primaryRemoteStream ? (
                    <StreamView
                        key={primaryRemoteRenderKey}
                        stream={primaryRemoteStream as unknown as MediaStream}
                        style={styles.remotePrimaryVideo}
                        objectFit="cover"
                        zOrder={20}
                    />
                ) : localStream ? (
                    <StreamView
                        stream={localStream as unknown as MediaStream}
                        style={styles.localVideo}
                        objectFit="cover"
                        mirror={true}
                        zOrder={0}
                    />
                ) : (
                    <PlaceholderVideo state={state} />
                )}

                {/* Local preview always visible as PiP once camera is active */}
                {showLocalPip && (
                    <View style={styles.localPipContainer}>
                        <StreamView
                            key={`local-${(localStream as any).id ?? 'stream'}`}
                            stream={localStream as unknown as MediaStream}
                            style={styles.localPipVideo}
                            objectFit="cover"
                            mirror={true}
                            zOrder={30}
                        />
                    </View>
                )}

                {__DEV__ && (
                    <View style={styles.debugOverlay}>
                        <Text style={styles.debugText}>remoteStreams={remoteStreams.length} primary={primaryRemoteStream ? 'yes' : 'no'} primaryToURL={primaryHasToURL ? 'yes' : 'no'}</Text>
                        <Text style={styles.debugText} numberOfLines={3}>{remoteDebugSummary || 'no-remote-stream'}</Text>
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
    localPipContainer: {
        position: 'absolute',
        top: 12,
        right: 12,
        gap: 8,
    },
    localPipVideo: {
        width: 120,
        height: 90,
        borderRadius: 12,
        backgroundColor: '#333',
    },
    remotePrimaryVideo: {
        flex: 1,
        borderRadius: 16,
        backgroundColor: '#000',
    },
    debugOverlay: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    debugText: {
        color: '#B7FFB7',
        fontSize: 10,
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
