import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import FloatingLabelInput from '@/components/FloatingLabelInput';
import { AddRow, NumberedList, RemovableChips } from '@/components/studio/ListEditors';
import { FieldLabel, IconButton, Notice, Panel, StudioInput } from '@/components/studio/primitives';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles } from '@/contexts/ThemeContext';
import { type StudioForm } from '@/hooks/useStudioForm';
import {
    canAppendHint,
    COOK_TIMER_MAX_MINUTES,
    DEFAULT_QUANTITY,
    DESCRIPTION_HINTS,
    DESCRIPTION_MAX,
    parseMinutes,
    type RecipeForm,
} from '@/utils/studioRecipe';

type Props = {
    form: StudioForm;
    onChange: (patch: Partial<StudioForm>) => void;
    onRecipeChange: (patch: Partial<RecipeForm>) => void;
    onAddHint: (hint: string) => void;
};

function MinutesField({
    label,
    value,
    onChange,
    max,
    testID,
}: Readonly<{ label: string; value: number; onChange: (minutes: number) => void; max?: number; testID: string }>) {
    const styles = useStyles();
    return (
        <Panel style={styles.minutesPanel}>
            <View style={styles.minutesInputRow}>
                <StudioInput
                    style={styles.minutesInput}
                    value={value === 0 ? '' : String(value)}
                    onChangeText={(text) => onChange(parseMinutes(text, max))}
                    placeholder="0"
                    accessibilityLabel={label}
                    keyboardType="number-pad"
                    maxLength={3}
                    textAlign="center"
                    testID={testID}
                />
                <Text style={styles.unit}>min</Text>
            </View>
        </Panel>
    );
}

/** Step 2: description, then the recipe the viewers will follow (ingredients, steps, times, utensils, plating). */
export default function StepRecipe({ form, onChange, onRecipeChange, onAddHint }: Readonly<Props>) {
    const { t } = useI18n();
    const styles = useStyles();
    const { recipe, description } = form;

    const [focused, setFocused] = useState(false);
    const [ingName, setIngName] = useState('');
    const [ingQty, setIngQty] = useState('');
    const [prepStep, setPrepStep] = useState('');
    const [utensil, setUtensil] = useState('');
    const [platingStep, setPlatingStep] = useState('');

    const addIngredient = () => {
        const name = ingName.trim();
        if (!name) return;
        onRecipeChange({ ingredients: [...recipe.ingredients, { name, qty: ingQty.trim() || DEFAULT_QUANTITY }] });
        setIngName('');
        setIngQty('');
    };
    const addPrepStep = () => {
        const text = prepStep.trim();
        if (!text) return;
        onRecipeChange({ prepSteps: [...recipe.prepSteps, text] });
        setPrepStep('');
    };
    const addUtensil = () => {
        const text = utensil.trim();
        if (!text) return;
        if (!recipe.utensils.includes(text)) onRecipeChange({ utensils: [...recipe.utensils, text] });
        setUtensil('');
    };
    const addPlating = () => {
        const text = platingStep.trim();
        if (!text) return;
        onRecipeChange({ platingSteps: [...recipe.platingSteps, text] });
        setPlatingStep('');
    };

    const count = description.length;
    const countTone = count >= DESCRIPTION_MAX ? 'danger' : count >= DESCRIPTION_MAX * 0.9 ? 'warn' : 'muted';

    return (
        <View style={styles.stack}>
            <View style={styles.field}>
                <FieldLabel label={t('studio.info.desc')} hint={`${count}/${DESCRIPTION_MAX}`} hintTone={countTone} />
                <FloatingLabelInput
                    label={t('studio.info.descPlaceholder')}
                    iconName="document-text-outline"
                    value={description}
                    onChangeText={(value) => onChange({ description: value.slice(0, DESCRIPTION_MAX) })}
                    focused={focused}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    maxLength={DESCRIPTION_MAX}
                    multiline
                    testID="studio-description"
                />
                <View style={styles.hints}>
                    <Text style={styles.hintLabel}>{t('studio.info.quickTags')}</Text>
                    {DESCRIPTION_HINTS.map((hint) => {
                        const allowed = canAppendHint(description, hint);
                        return (
                            <Pressable
                                key={hint}
                                onPress={() => onAddHint(hint)}
                                disabled={!allowed}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: !allowed }}
                                style={[styles.hint, !allowed && styles.hintDisabled]}
                                testID={`hint-${hint}`}
                            >
                                <Text style={styles.hintText}>{`+ ${hint}`}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <View style={styles.recipeCard}>
                <Text style={styles.recipeTitle} accessibilityRole="header">
                    {t('studio.recipe.title')}
                </Text>

                <View style={styles.field}>
                    <FieldLabel label={t('studio.recipe.ingredients')} />
                    <Panel>
                        <View style={styles.ingredientRow}>
                            <StudioInput
                                style={styles.ingredientName}
                                value={ingName}
                                onChangeText={setIngName}
                                placeholder={t('studio.recipe.ingNamePlaceholder')}
                                returnKeyType="next"
                                testID="ingredient-name"
                            />
                            <StudioInput
                                style={styles.ingredientQty}
                                value={ingQty}
                                onChangeText={setIngQty}
                                placeholder={t('studio.recipe.ingQtyPlaceholder')}
                                returnKeyType="done"
                                onSubmitEditing={addIngredient}
                                blurOnSubmit={false}
                                testID="ingredient-qty"
                            />
                            <IconButton icon="add" label={t('studio.recipe.addIngredient')} onPress={addIngredient} disabled={!ingName.trim()} testID="ingredient-add" />
                        </View>
                        <RemovableChips
                            items={recipe.ingredients.map((ing) => `${ing.name} (${ing.qty})`)}
                            onRemove={(index) => onRecipeChange({ ingredients: recipe.ingredients.filter((_, i) => i !== index) })}
                            testID="ingredient"
                        />
                    </Panel>
                </View>

                <View style={styles.field}>
                    <FieldLabel label={t('studio.recipe.steps')} />
                    <Panel>
                        {recipe.prepSteps.length > 0 ? <Notice tone="info">{`💡 ${t('studio.recipe.stepsDraftTip')}`}</Notice> : null}
                        <AddRow
                            value={prepStep}
                            onChangeText={setPrepStep}
                            onAdd={addPrepStep}
                            placeholder={t('studio.recipe.stepPlaceholder')}
                            addLabel={t('studio.recipe.addStep')}
                            testID="prep-step"
                        />
                        <NumberedList
                            items={recipe.prepSteps}
                            onRemove={(index) => onRecipeChange({ prepSteps: recipe.prepSteps.filter((_, i) => i !== index) })}
                            onEdit={(index, text) => onRecipeChange({ prepSteps: recipe.prepSteps.map((s, i) => (i === index ? text : s)) })}
                            testID="prep-step-item"
                        />
                    </Panel>
                </View>

                <View style={styles.minutesRow}>
                    <View style={styles.minutesCol}>
                        <FieldLabel label={t('studio.recipe.prepTime')} />
                        <MinutesField label={t('studio.recipe.prepTime')} value={recipe.prepTimeMins} onChange={(v) => onRecipeChange({ prepTimeMins: v })} testID="prep-time" />
                    </View>
                    <View style={styles.minutesCol}>
                        <FieldLabel label={t('studio.recipe.restTime')} />
                        <MinutesField label={t('studio.recipe.restTime')} value={recipe.restTimeMins} onChange={(v) => onRecipeChange({ restTimeMins: v })} testID="rest-time" />
                    </View>
                </View>

                <View style={styles.field}>
                    <FieldLabel label={t('studio.recipe.utensils')} />
                    <Panel>
                        <AddRow
                            value={utensil}
                            onChangeText={setUtensil}
                            onAdd={addUtensil}
                            placeholder={t('studio.recipe.utensilPlaceholder')}
                            addLabel={t('studio.recipe.addUtensil')}
                            testID="utensil"
                        />
                        <RemovableChips items={recipe.utensils} onRemove={(index) => onRecipeChange({ utensils: recipe.utensils.filter((_, i) => i !== index) })} testID="utensil-item" />
                    </Panel>
                </View>

                <View style={styles.field}>
                    <FieldLabel label={t('studio.recipe.cookTime')} />
                    <MinutesField
                        label={t('studio.recipe.cookTime')}
                        value={recipe.cookTimeMins}
                        onChange={(v) => onRecipeChange({ cookTimeMins: v })}
                        max={COOK_TIMER_MAX_MINUTES}
                        testID="cook-time"
                    />
                </View>

                <View style={styles.field}>
                    <FieldLabel label={t('studio.recipe.plating')} />
                    <Panel>
                        <AddRow
                            value={platingStep}
                            onChangeText={setPlatingStep}
                            onAdd={addPlating}
                            placeholder={t('studio.recipe.platingPlaceholder')}
                            addLabel={t('studio.recipe.addPlating')}
                            testID="plating"
                        />
                        <NumberedList
                            items={recipe.platingSteps}
                            onRemove={(index) => onRecipeChange({ platingSteps: recipe.platingSteps.filter((_, i) => i !== index) })}
                            testID="plating-item"
                        />
                    </Panel>
                </View>
            </View>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    stack: {
        gap: 18,
    },
    field: {
        gap: 8,
    },
    hints: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
    },
    hintLabel: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
    },
    hint: {
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    hintDisabled: {
        opacity: 0.4,
    },
    hintText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
    },
    recipeCard: {
        borderWidth: 1,
        borderColor: colors.orangeGlow,
        borderRadius: radii.card,
        padding: 16,
        gap: 18,
    },
    recipeTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    ingredientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ingredientName: {
        flex: 1,
        minWidth: 0,
    },
    ingredientQty: {
        width: 86,
    },
    minutesRow: {
        flexDirection: 'row',
        gap: 12,
    },
    minutesCol: {
        flex: 1,
        gap: 8,
    },
    minutesPanel: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    minutesInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    minutesInput: {
        // two columns on a 360 px phone leave ~110 px: input + "min" must fit
        width: 64,
        fontWeight: '800',
    },
    unit: {
        color: colors.muted,
        fontSize: 14,
        fontWeight: '600',
    },
}));
