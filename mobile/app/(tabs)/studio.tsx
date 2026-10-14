import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import FloatingLabelInput from '@/components/FloatingLabelInput';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Screen from '@/components/ui/Screen';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { getMyScheduledLive, type MyScheduledLive } from '@/services/social';
import { TAG_GROUPS } from '@/utils/studioTags';
import { haptics } from '@/utils/haptics';
import {
    LIVE_DESCRIPTION_MAX,
    LIVE_TAGS_MAX,
    LIVE_TITLE_MAX,
    LIVE_TITLE_MIN,
    sanitizeDescription,
    sanitizeTitle,
    serializeTags,
    validateTitle,
    type TitleError,
} from '@/utils/webrtcParams';

type Field = 'title' | 'description' | null;

export default function StudioScreen() {
    const router = useRouter();
    const { t, locale } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [focused, setFocused] = useState<Field>(null);
    const [submitted, setSubmitted] = useState(false);
    const [tagsNotice, setTagsNotice] = useState(false);
    const [scheduled, setScheduled] = useState<MyScheduledLive | null>(null);
    const navigatingRef = useRef(false);

    // Refreshed every time the tab is focused (the live may have been scheduled/ended elsewhere).
    useFocusEffect(
        useCallback(() => {
            navigatingRef.current = false;
            let cancelled = false;
            getMyScheduledLive()
                .then((live) => {
                    if (!cancelled) setScheduled(live);
                })
                .catch(() => {
                    // Non-critical: the form stays usable (the backend still rejects a second live).
                    if (!cancelled) setScheduled(null);
                });
            return () => {
                cancelled = true;
            };
        }, [])
    );

    const titleError: TitleError = validateTitle(title);
    const showTitleError = submitted && titleError !== null;

    const titleErrorText = (): string | null => {
        if (!showTitleError) return null;
        if (titleError === 'tooShort') return t('studio.go.titleTooShort', { min: LIVE_TITLE_MIN });
        if (titleError === 'tooLong') return t('studio.go.titleTooLong', { max: LIVE_TITLE_MAX });
        return t('studio.error.titleRequired');
    };

    const toggleTag = (tag: string) => {
        if (tags.includes(tag)) {
            setTags(tags.filter((item) => item !== tag));
            setTagsNotice(false);
            return;
        }
        if (tags.length >= LIVE_TAGS_MAX) {
            setTagsNotice(true);
            return;
        }
        setTags([...tags, tag]);
    };

    const goLive = () => {
        if (navigatingRef.current) return;
        setSubmitted(true);
        if (titleError !== null || scheduled) return;

        navigatingRef.current = true;
        haptics.tap();
        const cleanDescription = sanitizeDescription(description);
        router.push({
            pathname: '/live-streaming',
            params: {
                mode: 'host',
                title: sanitizeTitle(title),
                ...(cleanDescription ? { description: cleanDescription } : {}),
                ...(tags.length > 0 ? { tags: serializeTags(tags) } : {}),
            },
        });
    };

    const startScheduled = () => {
        if (!scheduled || navigatingRef.current) return;
        navigatingRef.current = true;
        router.push({ pathname: '/live-streaming', params: { mode: 'host', roomId: scheduled.room_id } });
    };

    const scheduledDate = scheduled?.scheduled_at ? new Date(scheduled.scheduled_at) : null;
    const scheduledLabel =
        scheduledDate && !Number.isNaN(scheduledDate.getTime())
            ? t('watch.room.scheduledFor', {
                  date: scheduledDate.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                  }),
              })
            : t('studio.go.scheduledNoDate');

    return (
        <Screen>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    testID="studio-scroll"
                >
                    <View style={styles.header}>
                        <Badge label={t('nav.studio')} tone="soft" />
                        <Text style={styles.heading} accessibilityRole="header">
                            {t('studio.go.heading')}
                        </Text>
                        <Text style={styles.subtitle}>{t('studio.go.subtitle')}</Text>
                    </View>

                    {scheduled ? (
                        <Card style={styles.card} testID="scheduled-live">
                            <View style={styles.cardBody}>
                                <Text style={styles.sectionTitle}>{t('studio.go.scheduledHeading')}</Text>
                                <Text style={styles.scheduledTitle} numberOfLines={2}>
                                    {scheduled.title}
                                </Text>
                                <Text style={styles.muted}>{scheduledLabel}</Text>
                                <Text style={styles.warning} accessibilityRole="alert">
                                    {t('studio.broadcast.activeLiveWarning')}
                                </Text>
                                <Button
                                    label={t('studio.go.scheduledStart')}
                                    onPress={startScheduled}
                                    icon={<Ionicons name="radio-outline" size={20} color={colors.onBrand} />}
                                    testID="start-scheduled"
                                />
                            </View>
                        </Card>
                    ) : null}

                    <Card style={styles.card}>
                        <View style={styles.cardBody}>
                            <Text style={styles.sectionTitle}>{t('studio.info.title')}</Text>

                            <FloatingLabelInput
                                label={t('studio.info.liveTitle')}
                                iconName="restaurant-outline"
                                value={title}
                                onChangeText={setTitle}
                                focused={focused === 'title'}
                                onFocus={() => setFocused('title')}
                                onBlur={() => setFocused(null)}
                                maxLength={LIVE_TITLE_MAX}
                                returnKeyType="next"
                                error={titleErrorText()}
                                accessibilityHint={t('studio.info.liveTitlePlaceholder')}
                                testID="studio-title"
                            />

                            <FloatingLabelInput
                                label={t('studio.info.desc')}
                                iconName="document-text-outline"
                                value={description}
                                onChangeText={(value) => setDescription(value.slice(0, LIVE_DESCRIPTION_MAX))}
                                focused={focused === 'description'}
                                onFocus={() => setFocused('description')}
                                onBlur={() => setFocused(null)}
                                maxLength={LIVE_DESCRIPTION_MAX}
                                multiline
                                testID="studio-description"
                            />

                            <View style={styles.tagsHeader}>
                                <Text style={styles.label}>{t('studio.info.tags')}</Text>
                                <Text style={styles.muted} testID="tags-count">
                                    {t('studio.go.tagsCount', { count: tags.length, max: LIVE_TAGS_MAX })}
                                </Text>
                            </View>
                            {tagsNotice ? (
                                <Text style={styles.warning} accessibilityRole="alert">
                                    {t('studio.go.tagsLimit', { max: LIVE_TAGS_MAX })}
                                </Text>
                            ) : null}

                            {TAG_GROUPS.map((group) => (
                                <View key={group.key} style={styles.tagGroup}>
                                    <Text style={styles.groupTitle}>{t(group.key)}</Text>
                                    <View style={styles.chips}>
                                        {group.tags.map((tag) => (
                                            <Chip
                                                key={tag}
                                                label={tag}
                                                active={tags.includes(tag)}
                                                onPress={() => toggleTag(tag)}
                                                style={styles.chip}
                                                testID={`tag-${tag}`}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </Card>

                    <Text style={styles.note}>{t('studio.go.cameraNote')}</Text>
                    <Text style={styles.note}>{t('studio.go.scheduleNote')}</Text>

                    <Button
                        label={t('studio.go.start')}
                        onPress={goLive}
                        disabled={!!scheduled}
                        icon={<Ionicons name="radio-outline" size={20} color={colors.onBrand} />}
                        testID="go-live"
                    />
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
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 32,
        gap: 16,
    },
    header: {
        gap: 8,
    },
    heading: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '800',
    },
    subtitle: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 21,
    },
    card: {
        width: '100%',
    },
    cardBody: {
        padding: 18,
        gap: 10,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
    },
    scheduledTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    label: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    muted: {
        color: colors.muted,
        fontSize: 13,
    },
    warning: {
        color: colors.warning,
        fontSize: 13,
        fontWeight: '600',
    },
    tagsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    tagGroup: {
        gap: 8,
    },
    groupTitle: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '600',
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        minHeight: 44,
    },
    note: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 18,
    },
}));
