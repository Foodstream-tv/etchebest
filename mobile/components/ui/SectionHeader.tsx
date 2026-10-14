import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type SectionHeaderProps = {
    title: string;
    subtitle?: string;
    /** Orange pill above the title (web "🔥 En direct" tag) */
    tag?: string;
    tagIcon?: IconName;
    actionLabel?: string;
    onAction?: () => void;
};

export default function SectionHeader({ title, subtitle, tag, tagIcon, actionLabel, onAction }: Readonly<SectionHeaderProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.row}>
            <View style={styles.texts}>
                {tag ? (
                    <View style={styles.tag}>
                        {tagIcon ? <Ionicons name={tagIcon} size={12} color={colors.orangeText} /> : null}
                        <Text style={styles.tagText}>{tag}</Text>
                    </View>
                ) : null}
                <Text style={styles.title} accessibilityRole="header">
                    {title}
                </Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {actionLabel && onAction ? (
                <Pressable onPress={onAction} accessibilityRole="link" accessibilityLabel={actionLabel} hitSlop={8} style={styles.action}>
                    <Text style={styles.actionText}>{actionLabel}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.orangeText} />
                </Pressable>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
    },
    texts: {
        flex: 1,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: colors.orangeSoft,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        marginBottom: 8,
    },
    tagText: {
        color: colors.orangeText,
        fontSize: 12,
        fontWeight: '700',
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    subtitle: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 2,
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingBottom: 2,
    },
    actionText: {
        color: colors.orangeText,
        fontSize: 14,
        fontWeight: '600',
    },
}));
