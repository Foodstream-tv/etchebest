import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import StepInfo from '@/components/studio/StepInfo';
import StepMedia from '@/components/studio/StepMedia';
import StepRecipe from '@/components/studio/StepRecipe';
import { Notice } from '@/components/studio/primitives';
import StudioPreviewCard from '@/components/studio/StudioPreviewCard';
import StudioStepper from '@/components/studio/StudioStepper';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Screen from '@/components/ui/Screen';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { useStudioForm, type StudioStep } from '@/hooks/useStudioForm';
import { ApiError } from '@/services/http';
import { getMyScheduledLive, type MyScheduledLive } from '@/services/social';
import { scheduleLive, stopMyActiveLive, uploadThumbnail } from '@/services/studio';
import { getPublicMediaUrl } from '@/utils/media';
import { buildDescription, recipeFromMarmiton, type MarmitonRecipe } from '@/utils/studioRecipe';
import { buildScheduledAt } from '@/utils/studioSchedule';
import { haptics } from '@/utils/haptics';
import { setLiveDraft } from '@/utils/liveDraft';
import { sanitizeDescription, sanitizeTitle, serializeTags } from '@/utils/webrtcParams';

type Busy = 'idle' | 'uploading' | 'scheduling';

const LEVEL_KEYS = {
    Débutant: 'studio.info.levelBeginner',
    Intermédiaire: 'studio.info.levelIntermediate',
    Avancé: 'studio.info.levelAdvanced',
} as const;

/** Remote image the user pasted: only http(s) reaches an <Image>. */
function remoteImageUri(raw: string): string {
    const value = raw.trim();
    return /^https?:\/\//i.test(value) ? value : '';
}

export default function StudioScreen() {
    const router = useRouter();
    const { t, locale } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();

    const studio = useStudioForm();
    const { step, setStep, form, update, updateRecipe, titleError, canStart, hasValidSchedule } = studio;

    const [submitted, setSubmitted] = useState(false);
    const [scheduleTried, setScheduleTried] = useState(false);
    const [busy, setBusy] = useState<Busy>('idle');
    const [error, setError] = useState<string | null>(null);
    const [conflict, setConflict] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [scheduled, setScheduled] = useState<MyScheduledLive | null>(null);

    const scrollRef = useRef<ScrollView>(null);
    const navigatingRef = useRef(false);
    const leftForLiveRef = useRef(false);
    /** Synchronous guard: `busy` is only visible on the next render, a fast double tap would slip through. */
    const submittingRef = useRef(false);

    const refreshScheduled = useCallback(async () => {
        try {
            setScheduled(await getMyScheduledLive());
        } catch {
            // Non-critical: the form stays usable (the backend still rejects a second live).
            setScheduled(null);
        }
    }, []);

    // Refreshed every time the tab is focused (the live may have been scheduled/ended elsewhere).
    useFocusEffect(
        useCallback(() => {
            navigatingRef.current = false;
            if (leftForLiveRef.current) {
                // Coming back from a broadcast: start the next live from a clean form.
                leftForLiveRef.current = false;
                studio.reset();
                setSubmitted(false);
                setScheduleTried(false);
                setError(null);
                setConflict(false);
            }
            void refreshScheduled();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [refreshScheduled])
    );

    const goToStep = (next: StudioStep) => {
        setStep(next);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
    };

    const handleImported = (recipe: MarmitonRecipe, sourceUrl: string) => {
        if (recipe.title) update({ title: recipe.title });
        if (recipe.description) update({ description: recipe.description.slice(0, 500) });
        updateRecipe(recipeFromMarmiton(recipe, sourceUrl));
    };

    /** Uploads the picked photo, or falls back to the pasted URL. Undefined = no thumbnail. */
    const resolveThumbnail = async (): Promise<string | undefined> => {
        if (form.image) return uploadThumbnail(form.image);
        return form.imageUrl.trim() || undefined;
    };

    /** Returns false (and shows why) when the form cannot be submitted yet. */
    const guardTitle = (): boolean => {
        setSubmitted(true);
        if (canStart) return true;
        goToStep(1);
        return false;
    };

    const goLive = async () => {
        if (submittingRef.current || navigatingRef.current || scheduled) return;
        setError(null);
        setConflict(false);
        setSuccess(null);
        if (!guardTitle()) return;

        submittingRef.current = true;
        setBusy('uploading');
        let thumbnailUrl: string | undefined;
        try {
            thumbnailUrl = await resolveThumbnail();
        } catch {
            setError(t('studio.go.uploadFailed'));
            return;
        } finally {
            submittingRef.current = false;
            setBusy('idle');
        }

        navigatingRef.current = true;
        leftForLiveRef.current = true;
        haptics.tap();
        // The description (recipe included) and the thumbnail go through memory, not the route (see liveDraft).
        const draft = setLiveDraft({ description: buildDescription(sanitizeDescription(form.description), form.recipe), thumbnailUrl });
        router.push({
            pathname: '/live-streaming',
            params: {
                mode: 'host',
                title: sanitizeTitle(form.title),
                ...(form.tags.length > 0 ? { tags: serializeTags(form.tags) } : {}),
                level: form.level,
                durationMinutes: String(form.durationMinutes),
                draft,
            },
        });
    };

    const schedule = async () => {
        if (submittingRef.current || scheduled) return;
        setError(null);
        setConflict(false);
        setSuccess(null);
        if (!guardTitle()) return;
        setScheduleTried(true);
        const scheduledAt = hasValidSchedule ? buildScheduledAt(form.date, form.time) : null;
        if (!scheduledAt) return;

        submittingRef.current = true;
        setBusy('uploading');
        let uploading = true;
        try {
            const thumbnailUrl = await resolveThumbnail();
            uploading = false;
            setBusy('scheduling');
            await scheduleLive({
                title: sanitizeTitle(form.title),
                description: buildDescription(sanitizeDescription(form.description), form.recipe),
                tags: form.tags,
                level: form.level,
                durationMinutes: form.durationMinutes,
                thumbnailUrl,
                scheduledAt,
            });
            haptics.success();
            studio.reset();
            setSubmitted(false);
            setScheduleTried(false);
            setSuccess(t('studio.go.scheduledSuccess'));
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            await refreshScheduled();
        } catch (err) {
            if (err instanceof ApiError && err.status === 409) {
                setConflict(true);
                setError(t('studio.go.activeLiveConflict'));
            } else if (uploading && form.image) {
                setError(t('studio.go.uploadFailed'));
            } else {
                setError(err instanceof Error && err.message ? err.message : t('studio.go.scheduleFailed'));
            }
        } finally {
            submittingRef.current = false;
            setBusy('idle');
        }
    };

    const stopActiveLive = async () => {
        if (stopping) return;
        setStopping(true);
        try {
            const stopped = await stopMyActiveLive();
            if (stopped) {
                setError(null);
                setConflict(false);
                await refreshScheduled();
            } else {
                setError(t('studio.go.noActiveLive'));
            }
        } catch {
            setError(t('studio.go.stopFailed'));
        } finally {
            setStopping(false);
        }
    };

    const startScheduled = () => {
        if (!scheduled || navigatingRef.current) return;
        navigatingRef.current = true;
        leftForLiveRef.current = true;
        router.push({ pathname: '/live-streaming', params: { mode: 'host', roomId: scheduled.room_id } });
    };

    const scheduledDate = scheduled?.scheduled_at ? new Date(scheduled.scheduled_at) : null;
    const scheduledLabel =
        scheduledDate && !Number.isNaN(scheduledDate.getTime())
            ? t('watch.room.scheduledFor', {
                  date: scheduledDate.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' }),
              })
            : t('studio.go.scheduledNoDate');

    const previewTitle = form.title.trim() || t('studio.preview.sampleTitle');
    const previewTags = [...form.tags.slice(0, 3), t(LEVEL_KEYS[form.level])];
    const previewImage = form.image?.uri || remoteImageUri(form.imageUrl) || getPublicMediaUrl(undefined);
    const submitting = busy !== 'idle';

    return (
        <Screen>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="studio-scroll">
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <Badge label="Foodstream Studio" tone="soft" />
                            <Badge label={t('studio.go.stepOf', { step, total: 3 })} tone="neutral" />
                        </View>
                        <Text style={styles.heading} accessibilityRole="header">
                            {t('studio.info.title')}
                        </Text>
                    </View>

                    {success ? (
                        <Notice tone="success" testID="schedule-success">
                            {success}
                        </Notice>
                    ) : null}

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

                    <StudioStepper active={step} onSelect={goToStep} />

                    <Card style={styles.card}>
                        <View style={styles.cardBody}>
                            {step === 1 ? (
                                <StepInfo
                                    form={form}
                                    titleError={titleError}
                                    showTitleError={submitted}
                                    onChange={update}
                                    onToggleTag={studio.toggleTag}
                                    onAddCustomTag={studio.addCustomTag}
                                    onImported={handleImported}
                                    onSourceChange={(sourceUrl, sourceName) => updateRecipe({ sourceUrl, sourceName })}
                                />
                            ) : null}
                            {step === 2 ? <StepRecipe form={form} onChange={update} onRecipeChange={updateRecipe} onAddHint={studio.addHint} /> : null}
                            {step === 3 ? (
                                <StepMedia form={form} onChange={update} onDuration={studio.setDuration} scheduleInvalid={scheduleTried && !hasValidSchedule} busy={submitting} />
                            ) : null}

                            <View style={styles.nav}>
                                {step > 1 ? (
                                    <Button
                                        label={t('studio.steps.prev')}
                                        variant="secondary"
                                        onPress={() => goToStep((step - 1) as StudioStep)}
                                        icon={<Ionicons name="arrow-back" size={18} color={colors.text} />}
                                        style={styles.navButton}
                                        testID="step-prev"
                                    />
                                ) : null}
                                {step < 3 ? (
                                    <Button
                                        label={t('studio.steps.next')}
                                        onPress={() => goToStep((step + 1) as StudioStep)}
                                        icon={<Ionicons name="arrow-forward" size={18} color={colors.onBrand} />}
                                        style={styles.navButton}
                                        testID="step-next"
                                    />
                                ) : null}
                            </View>

                            {step === 3 ? (
                                <View style={styles.actions}>
                                    <Button
                                        label={t('studio.broadcast.scheduleBtn')}
                                        onPress={schedule}
                                        loading={busy === 'scheduling' || (busy === 'uploading' && scheduleTried)}
                                        disabled={submitting || !!scheduled}
                                        icon={<Ionicons name="calendar-outline" size={20} color={colors.onBrand} />}
                                        testID="schedule-live"
                                    />
                                    <Button
                                        label={t('studio.broadcast.startNowBtn')}
                                        variant="secondary"
                                        onPress={goLive}
                                        loading={busy === 'uploading' && !scheduleTried}
                                        disabled={submitting || !!scheduled}
                                        icon={<Ionicons name="videocam-outline" size={20} color={colors.text} />}
                                        testID="go-live"
                                    />
                                    <Text style={styles.note}>{t('studio.go.cameraNote')}</Text>
                                    <Text style={styles.note}>{t('broadcast.recordingNotice')}</Text>
                                </View>
                            ) : null}

                            {error ? (
                                <View style={styles.errorBox} accessibilityRole="alert" testID="studio-error">
                                    <Text style={styles.errorText}>{error}</Text>
                                    {conflict ? (
                                        <Button
                                            label={stopping ? t('studio.broadcast.stoppingLive') : t('studio.broadcast.stopActiveLive')}
                                            variant="danger"
                                            size="sm"
                                            onPress={stopActiveLive}
                                            loading={stopping}
                                            testID="stop-active-live"
                                        />
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    </Card>

                    <StudioPreviewCard imageUri={previewImage} title={previewTitle} tags={previewTags} date={form.date} time={form.time} />
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
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
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    heading: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '800',
    },
    card: {
        width: '100%',
    },
    cardBody: {
        padding: 18,
        gap: 16,
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
    muted: {
        color: colors.muted,
        fontSize: 13,
    },
    warning: {
        color: colors.warning,
        fontSize: 13,
        fontWeight: '600',
    },
    nav: {
        gap: 10,
    },
    navButton: {
        alignSelf: 'stretch',
    },
    actions: {
        gap: 10,
    },
    note: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
    },
    errorBox: {
        gap: 10,
        padding: 12,
        borderRadius: radii.lg,
        backgroundColor: colors.dangerSoft,
    },
    errorText: {
        color: colors.danger,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
    },
}));
