import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function LiveStreamingPage({ route }: any) {
    const isHost = route?.params?.isHost;
    const roomId = route?.params?.roomId;
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{isHost ? 'You are hosting a live stream!' : `You joined stream: ${roomId || ''}`}</Text>
            <Text style={styles.desc}>This is a placeholder for the livestream interface.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FF5722',
        marginBottom: 16,
    },
    desc: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
    },
});
