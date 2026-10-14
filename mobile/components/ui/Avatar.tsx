import React, { useState } from 'react';
import { Image, StyleProp, Text, View, ViewStyle } from 'react-native';

import { makeStyles } from '@/contexts/ThemeContext';
import { getPublicMediaUrl } from '@/utils/media';

type AvatarProps = {
    uri?: string | null;
    name?: string;
    size?: number;
    style?: StyleProp<ViewStyle>;
};

export function initialsOf(name?: string, fallback?: string): string {
    return (name || fallback || '?')
        .trim()
        .split(/\s+/)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('') || '?';
}

/** Profile picture with initials fallback (same rule as the web top nav). */
export default function Avatar({ uri, name, size = 40, style }: Readonly<AvatarProps>) {
    const styles = useStyles();
    const [failed, setFailed] = useState(false);
    // Uploaded pictures are served as relative `/api/uploads/...` paths.
    const source = getPublicMediaUrl(uri);
    const dimension = { width: size, height: size, borderRadius: size / 2 };

    return (
        <View style={[styles.wrap, dimension, style]} accessibilityLabel={name}>
            {source && !failed ? (
                <Image source={{ uri: source }} style={dimension} onError={() => setFailed(true)} />
            ) : (
                <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.38) }]}>{initialsOf(name)}</Text>
            )}
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    wrap: {
        backgroundColor: colors.surfaceStrong,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    initials: {
        color: colors.text,
        fontWeight: '700',
    },
}));
