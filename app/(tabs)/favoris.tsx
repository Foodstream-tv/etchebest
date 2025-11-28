import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function FavoritesScreen()
{
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Favorites Page</Text>
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
