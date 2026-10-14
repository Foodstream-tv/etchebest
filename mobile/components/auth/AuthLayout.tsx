import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Card from '@/components/ui/Card';
import Screen from '@/components/ui/Screen';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/LanguageContext';

type AuthLayoutProps = React.PropsWithChildren<{
    /** Orange uppercase eyebrow (web `AuthCard` label) */
    label: string;
    title: string;
    subtitle?: string;
    /** Marketing block shown above the card (login) */
    hero?: React.ReactNode;
    /** Optional "back" link above the brand row */
    back?: { label: string; onPress: () => void; testID?: string };
    /** "No account yet? Sign up" row under the form */
    bottomText?: string;
    bottomLinkLabel?: string;
    onBottomLinkPress?: () => void;
    testID?: string;
}>;

/**
 * Shared frame of the auth screens, equivalent of the web `AuthCard`: themed page,
 * keyboard avoidance, brand row, then a rounded card with label / title / subtitle.
 */
export default function AuthLayout({
    label,
    title,
    subtitle,
    hero,
    back,
    bottomText,
    bottomLinkLabel,
    onBottomLinkPress,
    children,
    testID,
}: Readonly<AuthLayoutProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    return (
        <Screen edges={['top', 'bottom']} testID={testID}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    showsVerticalScrollIndicator={false}
                >
                    {back ? (
                        <Pressable
                            onPress={back.onPress}
                            testID={back.testID}
                            accessibilityRole="button"
                            accessibilityLabel={back.label}
                            hitSlop={8}
                            style={styles.back}
                        >
                            <Ionicons name="arrow-back" size={20} color={colors.text} />
                            <Text style={styles.backText}>{back.label}</Text>
                        </Pressable>
                    ) : null}

                    <View style={styles.brandRow}>
                        <Image
                            source={require('@/assets/images/logo.png')}
                            style={styles.logo}
                            resizeMode="cover"
                            accessibilityLabel={t('auth.brand.logoAlt')}
                        />
                        <Text style={styles.brand} accessibilityRole="header">
                            foodstream<Text style={styles.brandAccent}>.tv</Text>
                        </Text>
                    </View>

                    {hero}

                    <Card style={styles.card}>
                        <View style={styles.labelRow}>
                            <Ionicons name="flame-outline" size={16} color={colors.orange} />
                            <Text style={styles.label}>{label}</Text>
                        </View>
                        <Text style={styles.title} accessibilityRole="header">
                            {title}
                        </Text>
                        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

                        <View style={styles.body}>{children}</View>
                    </Card>

                    {bottomText && bottomLinkLabel ? (
                        <View style={styles.bottomRow}>
                            <Text style={styles.bottomText}>{bottomText}</Text>
                            <Pressable
                                onPress={onBottomLinkPress}
                                accessibilityRole="link"
                                accessibilityLabel={bottomLinkLabel}
                                hitSlop={8}
                                style={styles.bottomLinkWrap}
                            >
                                <Text style={styles.bottomLink}>{bottomLinkLabel}</Text>
                            </Pressable>
                        </View>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    flex: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 28,
        justifyContent: 'center',
        width: '100%',
        maxWidth: 520,
        alignSelf: 'center',
    },
    back: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
    },
    backText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
    },
    logo: {
        width: 40,
        height: 40,
        borderRadius: 999,
    },
    brand: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    brandAccent: {
        color: colors.orange,
    },
    card: {
        padding: 22,
        borderRadius: 32,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        color: colors.orangeText,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 3,
        textTransform: 'uppercase',
    },
    title: {
        marginTop: 12,
        color: colors.text,
        fontSize: 30,
        lineHeight: 34,
        fontWeight: '600',
        letterSpacing: -0.8,
    },
    subtitle: {
        marginTop: 10,
        color: colors.muted,
        fontSize: 14,
        lineHeight: 22,
    },
    body: {
        marginTop: 22,
    },
    bottomRow: {
        marginTop: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    bottomText: {
        color: colors.muted,
        fontSize: 14,
    },
    bottomLinkWrap: {
        minHeight: 44,
        justifyContent: 'center',
    },
    bottomLink: {
        color: colors.orangeText,
        fontSize: 14,
        fontWeight: '700',
    },
}));
