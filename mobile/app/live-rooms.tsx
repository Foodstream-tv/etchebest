import { brandTheme } from '@/constants/brandTheme';
import { createShadowStyle } from '@/utils/shadow';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRooms, RoomInfo, UnauthorizedError } from '../services/streaming';

const ORANGE_GRADIENT = brandTheme.gradients.primary;
const BACKGROUND = brandTheme.colors.bg;
const CARD = brandTheme.colors.surface;
const SURFACE_STRONG = brandTheme.colors.surfaceStrong;
const BORDER = brandTheme.colors.border;
const TEXT = brandTheme.colors.text;
const MUTED = brandTheme.colors.muted;

function RoomCard({ room, onWatch, onJoin }: Readonly<{ room: RoomInfo; onWatch: () => void; onJoin: () => void }>) {
    const spotsLeft = room.maxParticipants - room.participants.length;

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.liveDot} />
                <Text style={styles.cardTitle} numberOfLines={1}>{room.name}</Text>
            </View>

            <View style={styles.cardStats}>
                <View style={styles.stat}>
                    <Ionicons name="people-outline" size={14} color={MUTED} />
                    <Text style={styles.statText}>
                        {room.participants.length}/{room.maxParticipants} streamers
                    </Text>
                </View>
                <View style={styles.stat}>
                    <Ionicons name="eye-outline" size={14} color={MUTED} />
                    <Text style={styles.statText}>{room.viewers} spectateurs</Text>
                </View>
            </View>

            <View style={styles.cardActions}>
                {/* Watch as viewer (HLS) */}
                <TouchableOpacity onPress={onWatch} style={styles.watchButton}>
                    <Ionicons name="play-circle-outline" size={18} color="#FF7A00" />
                    <Text style={styles.watchText}>Regarder</Text>
                </TouchableOpacity>

                {/* Join as co-streamer (WebRTC) */}
                {spotsLeft > 0 ? (
                    <TouchableOpacity onPress={onJoin} activeOpacity={0.85}>
                        <LinearGradient
                            colors={ORANGE_GRADIENT}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.joinButton}
                        >
                            <Ionicons name="videocam-outline" size={16} color="#fff" />
                            <Text style={styles.joinText}>Rejoindre ({spotsLeft} place{spotsLeft > 1 ? 's' : ''})</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.fullBadge}>
                        <Text style={styles.fullText}>Complet</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

function RoomListContent({
    error,
    rooms,
    refreshing,
    onRefresh,
    onRetry,
    onWatch,
    onJoin,
}: Readonly<{
    error: string | null;
    rooms: RoomInfo[];
    refreshing: boolean;
    onRefresh: () => void;
    onRetry: () => void;
    onWatch: (room: RoomInfo) => void;
    onJoin: (room: RoomInfo) => void;
}>) {
    if (error) {
        return (
            <View style={styles.center}>
                <Ionicons name="cloud-offline-outline" size={48} color={MUTED} />
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                    <Text style={styles.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>
            </View>
        );
    }
    if (rooms.length === 0) {
        return (
            <View style={styles.center}>
                <Ionicons name="radio-outline" size={48} color={MUTED} />
                <Text style={styles.emptyText}>Aucun live en cours</Text>
                <Text style={styles.emptySubtext}>Sois le premier à lancer un live !</Text>
            </View>
        );
    }
    return (
        <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
                <RoomCard
                    room={item}
                    onWatch={() => onWatch(item)}
                    onJoin={() => onJoin(item)}
                />
            )}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF7A00" />
            }
        />
    );
}

export default function LiveRoomsScreen() {
    const router = useRouter();
    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
        try {
            setError(null);
            const data = await getRooms();
            setRooms(data || []);
        } catch (err: any) {
            if (err instanceof UnauthorizedError) {
                router.replace('/login' as any);
                return;
            }
            setError(err.message || 'Impossible de charger les salles');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRooms();
    }, [fetchRooms]);

    const handleWatch = (room: RoomInfo) => {
        router.push({
            pathname: '/live-viewer',
            params: { roomId: room.id, roomName: room.name },
        });
    };

    const handleJoinAsCoStreamer = (room: RoomInfo) => {
        router.push({
            pathname: '/live-streaming',
            params: { roomId: room.id, mode: 'join' },
        });
    };

    const handleCreateLive = () => {
        router.push({ pathname: '/live-streaming', params: { mode: 'host' } });
    };

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={TEXT} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lives en cours</Text>
                <TouchableOpacity onPress={fetchRooms}>
                    <Ionicons name="refresh-outline" size={22} color={MUTED} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF7A00" />
                </View>
            ) : (
                <RoomListContent
                    error={error}
                    rooms={rooms}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    onRetry={fetchRooms}
                    onWatch={handleWatch}
                    onJoin={handleJoinAsCoStreamer}
                />
            )}

            {/* FAB: Create new live */}
            <TouchableOpacity
                onPress={handleCreateLive}
                activeOpacity={0.85}
                style={styles.fab}
            >
                <LinearGradient
                    colors={ORANGE_GRADIENT}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.fabGradient}
                >
                    <Ionicons name="radio-outline" size={24} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BACKGROUND,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: SURFACE_STRONG,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: TEXT,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        padding: 24,
    },
    emptyText: {
        fontSize: 16,
        color: MUTED,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: MUTED,
    },
    retryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FF7A00',
        marginTop: 4,
    },
    retryBtnText: {
        color: '#FF7A00',
        fontWeight: '700',
    },
    list: {
        padding: 16,
        gap: 12,
    },
    card: {
        backgroundColor: CARD,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        gap: 12,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    liveDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF3B30',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: TEXT,
        flex: 1,
    },
    cardStats: {
        flexDirection: 'row',
        gap: 16,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: MUTED,
        fontSize: 13,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    watchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: SURFACE_STRONG,
    },
    watchText: {
        color: '#FF7A00',
        fontWeight: '700',
        fontSize: 13,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    joinText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    fullBadge: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: SURFACE_STRONG,
    },
    fullText: {
        color: MUTED,
        fontWeight: '700',
        fontSize: 13,
    },
    fab: {
        position: 'absolute',
        bottom: 28,
        right: 20,
    },
    fabGradient: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        ...createShadowStyle({
            color: '#FF7A00',
            offset: { width: 0, height: 4 },
            opacity: 0.3,
            radius: 8,
            elevation: 6,
        }),
    },
});
