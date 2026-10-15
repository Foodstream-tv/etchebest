import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import CheckRow from '@/components/cooking/CheckRow';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { type CookingPhase, type CookingProgress } from '@/hooks/useCookingProgress';
import { formatTimer, type CookingRecipe } from '@/utils/recipe';

const PHASES = [
    { phase: 0, key: 'cook.tabIngredients' },
    { phase: 1, key: 'cook.tabPrep' },
    { phase: 2, key: 'cook.tabCooking' },
    { phase: 3, key: 'cook.tabPlating' },
] as const;

type Props = {
    recipe: CookingRecipe;
    progress: CookingProgress;
};

function ProgressBar({ done, total }: Readonly<{ done: number; total: number }>) {
    const styles = useStyles();
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
    );
}

/** "Cuisine Coop": follow the host's recipe along the live (ingredients, preparation, cooking timer, plating). */
export default function CookingAssistant({ recipe, progress }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const { phase, timer } = progress;

    const go = (next: number) => progress.setPhase(Math.min(3, Math.max(0, next)) as CookingPhase);

    const heading = (label: string, done?: number, total?: number) => (
        <View style={styles.headingRow}>
            <Text style={styles.heading}>{label}</Text>
            {total ? (
                <Text style={styles.counter}>
                    {done}/{total}
                </Text>
            ) : null}
        </View>
    );

    return (
        <View style={styles.root} testID="cooking-assistant">
            <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                    <Ionicons name="restaurant-outline" size={20} color={colors.orange} />
                    <Text style={styles.title} accessibilityRole="header">
                        {t('cook.assistantTitle')}
                    </Text>
                </View>
                <Text style={styles.step} testID="cooking-step">
                    {t('cook.step', { step: phase + 1, total: 4 })}
                </Text>
            </View>

            <View style={styles.phases} accessibilityRole="tablist">
                {PHASES.map(({ phase: id, key }) => {
                    const active = phase === id;
                    const completed = phase > id;
                    return (
                        <Pressable
                            key={id}
                            onPress={() => go(id)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            style={[styles.phase, active && styles.phaseActive, completed && styles.phaseDone]}
                            testID={`cooking-phase-${id}`}
                        >
                            {completed ? <Ionicons name="checkmark" size={14} color={colors.orangeText} /> : null}
                            <Text
                                style={[styles.phaseLabel, active && styles.phaseLabelActive, completed && styles.phaseLabelDone]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                {t(key)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {phase === 0 ? (
                <View style={styles.section} testID="cooking-ingredients">
                    {heading(t('cook.ingredientsRequired'), progress.checked.length, recipe.ingredients.length)}
                    <ProgressBar done={progress.checked.length} total={recipe.ingredients.length} />
                    {recipe.ingredients.length > 0 && progress.checked.length === recipe.ingredients.length ? (
                        <Text style={styles.allReady}>{t('cook.allReady')}</Text>
                    ) : null}
                    {recipe.ingredients.map((item, index) => (
                        <CheckRow
                            key={`${item.name}-${index}`}
                            title={item.name}
                            detail={item.qty || undefined}
                            checked={progress.checked.includes(index)}
                            onToggle={() => progress.toggleIngredient(index)}
                            testID={`ingredient-${index}`}
                        />
                    ))}
                    {recipe.utensils.length > 0 ? (
                        <View style={styles.utensils}>
                            {heading(t('cook.utensilsNeeded'))}
                            <View style={styles.chips}>
                                {recipe.utensils.map((utensil) => (
                                    <View key={utensil} style={styles.chip}>
                                        <Text style={styles.chipText}>{utensil}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}
                </View>
            ) : null}

            {phase === 1 ? (
                <View style={styles.section} testID="cooking-prep">
                    {recipe.prepTimeMins > 0 || recipe.restTimeMins > 0 ? (
                        <View style={styles.chips}>
                            {recipe.prepTimeMins > 0 ? (
                                <View style={styles.chip}>
                                    <Text style={styles.chipText}>{t('cook.prepTime', { mins: recipe.prepTimeMins })}</Text>
                                </View>
                            ) : null}
                            {recipe.restTimeMins > 0 ? (
                                <View style={styles.chip}>
                                    <Text style={styles.chipText}>{t('cook.restTime', { mins: recipe.restTimeMins })}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                    {recipe.techniques.length > 0 ? (
                        <>
                            {heading(t('cook.techniques'), progress.prepDone.length, recipe.techniques.length)}
                            <ProgressBar done={progress.prepDone.length} total={recipe.techniques.length} />
                            {recipe.techniques.map((item, index) => (
                                <CheckRow
                                    key={`${item.desc}-${index}`}
                                    title={item.name || item.desc}
                                    detail={item.name ? item.desc : undefined}
                                    checked={progress.prepDone.includes(index)}
                                    onToggle={() => progress.togglePrep(index)}
                                    testID={`prep-${index}`}
                                />
                            ))}
                        </>
                    ) : (
                        <>
                            {heading(t('cook.prepTitle'))}
                            <Text style={styles.body}>{t('cook.prepDesc')}</Text>
                        </>
                    )}
                </View>
            ) : null}

            {phase === 2 ? (
                <View style={styles.section} testID="cooking-cooking">
                    {heading(t('cook.cookingInstructions'))}
                    <Text style={styles.body}>{t('live.recipe.cookingHint1')}</Text>
                    <Text style={styles.body}>{t('live.recipe.cookingHint2')}</Text>
                    {timer.total > 0 ? (
                        <View style={styles.timerCard}>
                            <Text style={styles.timerLabel}>{t('live.recipe.timerLabel')}</Text>
                            <Text
                                style={[styles.timerValue, timer.done && styles.timerDone]}
                                accessibilityRole="timer"
                                accessibilityLabel={formatTimer(timer.left)}
                                testID="cooking-timer"
                            >
                                {formatTimer(timer.left)}
                            </Text>
                            {timer.done ? <Text style={styles.timerDoneText}>{t('live.recipe.timerDone')}</Text> : null}
                            <View style={styles.timerButtons}>
                                {timer.running ? (
                                    <Button label={t('cook.timerPause')} variant="secondary" onPress={timer.pause} style={styles.timerButton} testID="cooking-timer-pause" />
                                ) : (
                                    <Button
                                        label={t('cook.timerStart')}
                                        onPress={timer.start}
                                        icon={<Ionicons name="play" size={18} color={colors.onBrand} />}
                                        style={styles.timerButton}
                                        testID="cooking-timer-start"
                                    />
                                )}
                                <Button label={t('cook.timerReset')} variant="secondary" onPress={timer.reset} style={styles.timerButton} testID="cooking-timer-reset" />
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.body} testID="cooking-no-timer">
                            {t('live.recipe.noTimer')}
                        </Text>
                    )}
                </View>
            ) : null}

            {phase === 3 ? (
                <View style={styles.section} testID="cooking-plating">
                    {heading(t('cook.platingTips'), progress.platingDone.length, recipe.plating.length)}
                    {recipe.plating.length > 0 ? <ProgressBar done={progress.platingDone.length} total={recipe.plating.length} /> : null}
                    {recipe.plating.map((step, index) => (
                        <CheckRow key={`${step}-${index}`} title={step} checked={progress.platingDone.includes(index)} onToggle={() => progress.togglePlating(index)} testID={`plating-${index}`} />
                    ))}
                    {recipe.plating.length > 0 && progress.platingDone.length === recipe.plating.length ? <Text style={styles.allReady}>{t('cook.done')}</Text> : null}
                </View>
            ) : null}

            <View style={styles.nav}>
                {phase > 0 ? (
                    <Button
                        label={t('cook.prevStep')}
                        variant="secondary"
                        onPress={() => go(phase - 1)}
                        icon={<Ionicons name="arrow-back" size={18} color={colors.text} />}
                        style={styles.navButton}
                        testID="cooking-prev"
                    />
                ) : null}
                {phase < 3 ? (
                    <Button
                        label={t('cook.nextStep')}
                        onPress={() => go(phase + 1)}
                        icon={<Ionicons name="arrow-forward" size={18} color={colors.onBrand} />}
                        style={styles.navButton}
                        testID="cooking-next"
                    />
                ) : null}
            </View>

            {recipe.sourceUrl ? (
                <Pressable
                    onPress={() => void Linking.openURL(recipe.sourceUrl as string)}
                    accessibilityRole="link"
                    style={styles.source}
                    testID="cooking-source"
                >
                    <Ionicons name="link-outline" size={16} color={colors.muted} />
                    <Text style={styles.sourceText} numberOfLines={1}>
                        {t('live.recipe.source', { name: recipe.sourceName ?? t('live.recipe.sourceDefault') })}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    root: {
        gap: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    titleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
    },
    step: {
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '800',
    },
    phases: {
        flexDirection: 'row',
        gap: 6,
    },
    phase: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 4,
        borderRadius: radii.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    phaseActive: {
        backgroundColor: colors.orange,
        borderColor: colors.orange,
    },
    phaseDone: {
        backgroundColor: colors.orangeSoft,
        borderColor: colors.orangeGlow,
    },
    phaseLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
    },
    phaseLabelActive: {
        color: colors.onBrand,
    },
    phaseLabelDone: {
        color: colors.orangeText,
    },
    section: {
        gap: 10,
    },
    headingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    heading: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    counter: {
        color: colors.orangeText,
        fontSize: 14,
        fontWeight: '800',
    },
    bar: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.surfaceStrong,
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: colors.orange,
    },
    allReady: {
        color: colors.success,
        fontSize: 15,
        fontWeight: '700',
    },
    body: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 23,
    },
    utensils: {
        gap: 10,
        marginTop: 6,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceStrong,
    },
    chipText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    timerCard: {
        alignItems: 'center',
        gap: 8,
        padding: 18,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.orangeGlow,
        backgroundColor: colors.orangeSoft,
    },
    timerLabel: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    timerValue: {
        color: colors.text,
        fontSize: 56,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    timerDone: {
        color: colors.success,
    },
    timerDoneText: {
        color: colors.success,
        fontSize: 16,
        fontWeight: '800',
    },
    timerButtons: {
        flexDirection: 'row',
        gap: 10,
        alignSelf: 'stretch',
    },
    timerButton: {
        flex: 1,
    },
    nav: {
        gap: 10,
    },
    navButton: {
        alignSelf: 'stretch',
    },
    source: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
    },
    sourceText: {
        flex: 1,
        color: colors.muted,
        fontSize: 13,
        textDecorationLine: 'underline',
    },
}));
