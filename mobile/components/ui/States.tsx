import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/LanguageContext';
import { classifyError, describeError } from '@/utils/errorMessage';

import Button from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type StateProps = {
    title: string;
    description?: string;
    icon?: IconName;
    actionLabel?: string;
    onAction?: () => void;
    testID?: string;
};

export function EmptyState({ title, description, icon = 'restaurant-outline', actionLabel, onAction, testID }: Readonly<StateProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.wrap} testID={testID} accessibilityRole="summary">
            <View style={styles.iconBox}>
                <Ionicons name={icon} size={28} color={colors.orangeText} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
            {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="sm" variant="secondary" style={styles.action} /> : null}
        </View>
    );
}

type ErrorStateProps = {
    title: string;
    /** Explicit description; otherwise derived from `error`, else a neutral retry hint */
    description?: string;
    /** The caught error: the message says what actually failed (offline, server, not found…) */
    error?: unknown;
    onRetry?: () => void;
    testID?: string;
};

export function ErrorState({ title, description, error, onRetry, testID }: Readonly<ErrorStateProps>) {
    const { t } = useI18n();
    const offline = error !== undefined && classifyError(error) === 'offline';
    return (
        <EmptyState
            testID={testID}
            icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
            title={title}
            description={description ?? (error === undefined ? t('error.unknown') : describeError(error, t))}
            actionLabel={onRetry ? t('common.retry') : undefined}
            onAction={onRetry}
        />
    );
}

export function LoadingState({ label }: Readonly<{ label?: string }>) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
            <ActivityIndicator size="large" color={colors.orange} />
            {label ? <Text style={styles.description}>{label}</Text> : null}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 28,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: radii.lg,
        backgroundColor: colors.orangeSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    description: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        maxWidth: 320,
    },
    action: {
        marginTop: 6,
        alignSelf: 'center',
    },
}));
