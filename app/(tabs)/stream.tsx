import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StreamScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Stream Page</Text>
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
    text: {
        fontSize: 24,
        color: '#000000ff',
        fontWeight: 'bold',
    },
});
