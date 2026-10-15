import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconButton, StudioInput } from '@/components/studio/primitives';
import { makeStyles } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/LanguageContext';

type AddRowProps = {
    value: string;
    onChangeText: (value: string) => void;
    onAdd: () => void;
    placeholder: string;
    addLabel: string;
    testID: string;
    maxLength?: number;
};

/** One-line input + "+" button; the keyboard "done" key adds too. */
export function AddRow({ value, onChangeText, onAdd, placeholder, addLabel, testID, maxLength }: Readonly<AddRowProps>) {
    const styles = useStyles();
    return (
        <View style={styles.addRow}>
            <StudioInput
                style={styles.addInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                maxLength={maxLength}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={onAdd}
                testID={`${testID}-input`}
            />
            <IconButton icon="add" label={addLabel} onPress={onAdd} disabled={!value.trim()} testID={`${testID}-add`} />
        </View>
    );
}

/** Removable pills (utensils, ingredients). */
export function RemovableChips({
    items,
    onRemove,
    testID,
}: Readonly<{ items: readonly string[]; onRemove: (index: number) => void; testID: string }>) {
    const styles = useStyles();
    const { t } = useI18n();
    if (items.length === 0) return null;
    return (
        <View style={styles.chips}>
            {items.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.chip} testID={`${testID}-${index}`}>
                    <Text style={styles.chipText}>{item}</Text>
                    <Pressable
                        onPress={() => onRemove(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('common.delete')} ${item}`}
                        hitSlop={10}
                        testID={`${testID}-${index}-remove`}
                    >
                        <Text style={styles.chipRemove}>✕</Text>
                    </Pressable>
                </View>
            ))}
        </View>
    );
}

/** Numbered steps; with `onEdit` each step can be rewritten in place (web preparation steps). */
export function NumberedList({
    items,
    onRemove,
    onEdit,
    testID,
}: Readonly<{ items: readonly string[]; onRemove: (index: number) => void; onEdit?: (index: number, text: string) => void; testID: string }>) {
    const styles = useStyles();
    const { t } = useI18n();
    const [editing, setEditing] = useState<number | null>(null);
    const [draft, setDraft] = useState('');

    if (items.length === 0) return null;

    const startEdit = (index: number) => {
        setEditing(index);
        setDraft(items[index]);
    };
    const save = () => {
        const text = draft.trim();
        if (editing !== null && text && onEdit) onEdit(editing, text);
        setEditing(null);
    };

    return (
        <View style={styles.list}>
            {items.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.step} testID={`${testID}-${index}`}>
                    {editing === index ? (
                        <View style={styles.editBox}>
                            <StudioInput value={draft} onChangeText={setDraft} multiline style={styles.editInput} autoFocus testID={`${testID}-${index}-edit-input`} />
                            <View style={styles.editActions}>
                                <Pressable onPress={() => setEditing(null)} accessibilityRole="button" style={styles.textButton} testID={`${testID}-${index}-cancel`}>
                                    <Text style={styles.textButtonLabel}>{t('studio.recipe.cancelEdit')}</Text>
                                </Pressable>
                                <Pressable onPress={save} accessibilityRole="button" style={[styles.textButton, styles.saveButton]} testID={`${testID}-${index}-save`}>
                                    <Text style={styles.saveLabel}>{t('studio.recipe.saveStep')}</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.stepRow}>
                            <Text style={styles.stepText}>
                                <Text style={styles.stepNumber}>{index + 1}. </Text>
                                {item}
                            </Text>
                            <View style={styles.stepActions}>
                                {onEdit ? (
                                    <IconButton icon="pencil" label={t('studio.recipe.editStep')} tone="quiet" onPress={() => startEdit(index)} testID={`${testID}-${index}-edit`} />
                                ) : null}
                                <IconButton icon="close" label={t('common.delete')} tone="quiet" onPress={() => onRemove(index)} testID={`${testID}-${index}-remove`} />
                            </View>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addInput: {
        flex: 1,
        minWidth: 0,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.orangeSoft,
        paddingHorizontal: 12,
        paddingVertical: 7,
        maxWidth: '100%',
    },
    chipText: {
        flexShrink: 1,
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '700',
    },
    chipRemove: {
        color: colors.orangeText,
        fontSize: 13,
        fontWeight: '800',
    },
    list: {
        gap: 8,
    },
    step: {
        borderRadius: radii.md,
        backgroundColor: colors.surfaceStrong,
        padding: 10,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    stepText: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        lineHeight: 20,
    },
    stepNumber: {
        color: colors.orange,
        fontWeight: '800',
    },
    stepActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    editBox: {
        gap: 8,
    },
    editInput: {
        minHeight: 64,
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    textButton: {
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textButtonLabel: {
        color: colors.muted,
        fontSize: 13,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: colors.orange,
    },
    saveLabel: {
        color: colors.onBrand,
        fontSize: 13,
        fontWeight: '700',
    },
}));
