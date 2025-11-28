import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen()
{
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Profile Page</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000'
    },
});
