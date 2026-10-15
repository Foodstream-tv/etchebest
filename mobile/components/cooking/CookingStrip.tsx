import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { type CookingProgress } from '@/hooks/useCookingProgress';
import { formatTimer, type CookingRecipe } from '@/utils/recipe';

type Props = {
    recipe: CookingRecipe;
    progress: CookingProgress;
    onPress: () => void;
};

/** One glanceable line under the video: where the cook is in the recipe, the next ingredient, the timer. */
export default function CookingStrip({ recipe, progress, onPress }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const { phase, timer } = progress;

    const nextIngredient = phase === 0 ? recipe.ingredients.find((_, index) => !progress.checked.includes(index)) : undefined;

    const label =
        phase === 0
            ? t('cook.statusIngredients', { checked: progress.checked.length, total: recipe.ingredients.length })
            : phase === 1
              ? t('cook.statusPrep')
              : phase === 2
                ? t('cook.statusCooking')
                : t('cook.statusPlating');

    const showTimer = timer.total > 0 && (timer.running || timer.done);

    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('live.recipe.open')} style={({ pressed }) => [styles.strip, pressed && styles.pressed]} testID="cooking-strip">
            <Ionicons name="restaurant-outline" size={20} color={colors.orange} />
            <View style={styles.texts}>
                <Text style={styles.label} numberOfLines={1}>
                    {label}
                </Text>
                {nextIngredient ? (
                    <Text style={styles.hint} numberOfLines={1} testID="cooking-strip-next">
                        {t('live.recipe.next', { name: nextIngredient.name })}
                    </Text>
                ) : null}
            </View>
            {showTimer ? (
                <Text style={[styles.timer, timer.done && styles.timerDone]} testID="cooking-strip-timer">
                    {formatTimer(timer.left)}
                </Text>
            ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            )}
        </Pressable>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    strip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        marginHorizontal: 12,
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.orangeGlow,
        backgroundColor: colors.orangeSoft,
    },
    pressed: {
        opacity: 0.8,
    },
    texts: {
        flex: 1,
        gap: 2,
    },
    label: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
    },
    hint: {
        color: colors.muted,
        fontSize: 13,
    },
    timer: {
        color: colors.orangeText,
        fontSize: 22,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    timerDone: {
        color: colors.success,
    },
}));
