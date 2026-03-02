import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HLSPlayer from '../components/HLSPlayer';
import { getHLSUrl } from '../services/streaming';

export default function LiveViewerScreen() {
    const router = useRouter();
    const { roomId, roomName } = useLocalSearchParams<{
        roomId: string;
        roomName?: string;
    }>();
    const [hasError, setHasError] = useState(false);

    const hlsUrl = roomId ? getHLSUrl(roomId) : '';

    const renderVideoContent = () => {
        if (!roomId) {
            return (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                    <Text style={styles.errorText}>Aucune salle spécifiée</Text>
                </View>
            );
        }
        if (hasError) {
            return (
                <View style={styles.errorContainer}>
                    <Ionicons name="cloud-offline-outline" size={48} color="#FF3B30" />
                    <Text style={styles.errorText}>
                        Impossible de charger le stream.{'\n'}Le live n&apos;est peut-être pas encore commencé.
                    </Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                            setHasError(false);
                        }}
                    >
                        <Ionicons name="refresh-outline" size={18} color="#FF7A00" />
                        <Text style={styles.retryText}>Réessayer</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <HLSPlayer
                uri={hlsUrl}
                style={styles.video}
                onError={() => setHasError(true)}
            />
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <View style={styles.liveBadge}>
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                    <Text style={styles.roomName} numberOfLines={1}>
                        {roomName || `Salle ${roomId?.slice(0, 8)}`}
                    </Text>
                </View>
            </View>

            {/* Video player */}
            <View style={styles.videoContainer}>
                {renderVideoContent()}
            </View>

            {/* Footer info */}
            <View style={styles.footer}>
                <View style={styles.footerRow}>
                    <Ionicons name="eye-outline" size={18} color="#aaa" />
                    <Text style={styles.footerText}>Vous regardez en mode spectateur (HLS)</Text>
                </View>
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
    headerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    liveBadge: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 6,
    },
    liveBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    roomName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    videoContainer: {
        flex: 1,
        margin: 12,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    video: {
        flex: 1,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        padding: 24,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#FF7A00',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 8,
    },
    retryText: {
        color: '#FF7A00',
        fontWeight: '700',
    },
    footer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    footerText: {
        color: '#aaa',
        fontSize: 13,
    },
});
