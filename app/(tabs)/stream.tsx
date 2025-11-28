import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function StreamScreen() {
    const [modalVisible, setModalVisible] = useState(false);
    const router = useRouter();

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.liveButton} onPress={() => setModalVisible(true)}>
                <View style={styles.iconCircle}>
                    <Ionicons name="videocam" size={32} color="#FF5722" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.liveTitle}>Foodstream Live</Text>
                    <Text style={styles.liveDesc}>Share your cooking skills or watch others live !</Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color="#fff" style={styles.arrowIcon} />
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalPill} />
                        <Text style={styles.modalTitle}>Start or Join Stream</Text>
                        <View style={{ height: 24 }} />
                        <Pressable
                            style={[styles.optionButton, styles.startButton]}
                            onPress={() => {
                                setModalVisible(false);
                                router.push({ pathname: '/live-streaming', params: { isHost: "true" } });
                            }}  
                        >
                            <Ionicons name="videocam" size={28} color="#fff" style={styles.optionIcon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.optionTitle}>Start Streaming</Text>
                                <Text style={styles.optionDesc}>Share your kitchen with the world</Text>
                            </View>
                        </Pressable>
                        <View style={{ height: 16 }} />
                        <Pressable
                            style={[styles.optionButton, styles.joinButton]}
                            onPress={() => {
                                setModalVisible(false);
                                router.push({ pathname: '/live-streaming', params: { isHost: "false" } });
                            }}
                        >
                            <Ionicons name="tv" size={28} color="#fff" style={styles.optionIcon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.optionTitle}>Join Stream</Text>
                                <Text style={styles.optionDesc}>Watch and learn from others</Text>
                            </View>
                        </Pressable>
                        <View style={{ height: 24 }} />
                        <Pressable style={styles.closeButton} onPress={() => setModalVisible(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 24,
    },
    liveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'orange',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    iconCircle: {
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 8,
        marginRight: 20,
    },
    liveTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    liveDesc: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        marginTop: 6,
    },
    arrowIcon: {
        marginLeft: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    modalPill: {
        width: 40,
        height: 4,
        backgroundColor: '#eee',
        borderRadius: 2,
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        maxWidth: 350,
    },
    startButton: {
        backgroundColor: 'orange',
    },
    joinButton: {
        backgroundColor: '#42A5F5',
    },
    optionIcon: {
        marginRight: 16,
    },
    optionTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    optionDesc: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        marginTop: 2,
    },
    closeButton: {
        marginTop: 8,
        padding: 8,
    },
    closeText: {
        color: '#888',
        fontSize: 16,
    },
});
