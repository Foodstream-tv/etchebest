import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import FloatingLabelInput from '@/components/FloatingLabelInput';
import { AddRow } from '@/components/studio/ListEditors';
import MarmitonImport from '@/components/studio/MarmitonImport';
import { FieldLabel, Notice, Panel } from '@/components/studio/primitives';
import Chip from '@/components/ui/Chip';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { type TagResult, LEVELS, type Level, type StudioForm } from '@/hooks/useStudioForm';
import { sourceNameFor, type MarmitonRecipe } from '@/utils/studioRecipe';
import { TAG_GROUPS } from '@/utils/studioTags';
import { LIVE_TAGS_MAX, LIVE_TITLE_MAX, LIVE_TITLE_MIN, type TitleError } from '@/utils/webrtcParams';

const LEVEL_KEYS = {
    Débutant: 'studio.info.levelBeginner',
    Intermédiaire: 'studio.info.levelIntermediate',
    Avancé: 'studio.info.levelAdvanced',
} as const satisfies Record<Level, string>;

type Props = {
    form: StudioForm;
    titleError: TitleError;
    /** The title error only shows once the user tried to submit. */
    showTitleError: boolean;
    onChange: (patch: Partial<StudioForm>) => void;
    onToggleTag: (tag: string) => TagResult;
    onAddCustomTag: (tag: string) => TagResult;
    onImported: (recipe: MarmitonRecipe, sourceUrl: string) => void;
    onSourceChange: (url: string, name: string) => void;
};

/** Step 1: Marmiton import, recipe source, title, tags and level. */
export default function StepInfo({ form, titleError, showTitleError, onChange, onToggleTag, onAddCustomTag, onImported, onSourceChange }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const [openGroup, setOpenGroup] = useState<string>(TAG_GROUPS[0].key);
    const [customTag, setCustomTag] = useState('');
    const [focused, setFocused] = useState<'title' | 'source' | null>(null);
    const [tagNotice, setTagNotice] = useState(false);

    const titleErrorText = !showTitleError
        ? null
        : titleError === 'tooShort'
          ? t('studio.go.titleTooShort', { min: LIVE_TITLE_MIN })
          : titleError === 'tooLong'
            ? t('studio.go.titleTooLong', { max: LIVE_TITLE_MAX })
            : titleError === 'required'
              ? t('studio.error.titleRequired')
              : null;

    const handleTag = (result: TagResult) => setTagNotice(result === 'limit');

    const submitCustomTag = () => {
        const result = onAddCustomTag(customTag);
        handleTag(result);
        if (result === 'added' || result === 'duplicate') setCustomTag('');
    };

    return (
        <View style={styles.stack}>
            <MarmitonImport onImported={onImported} />

            <View style={styles.field}>
                <FieldLabel label={t('studio.source.label')} />
                <Text style={styles.help}>{t('studio.source.citationNotice')}</Text>
                <FloatingLabelInput
                    label={t('studio.source.placeholder')}
                    iconName="link-outline"
                    value={form.recipe.sourceUrl}
                    onChangeText={(value) => onSourceChange(value, sourceNameFor(value))}
                    focused={focused === 'source'}
                    onFocus={() => setFocused('source')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    testID="studio-source"
                />
            </View>

            <View style={styles.field}>
                <FieldLabel label={t('studio.info.liveTitle')} hint={`${form.title.length}/${LIVE_TITLE_MAX}`} />
                <FloatingLabelInput
                    label={t('studio.info.liveTitlePlaceholder')}
                    iconName="restaurant-outline"
                    value={form.title}
                    onChangeText={(value) => onChange({ title: value })}
                    focused={focused === 'title'}
                    onFocus={() => setFocused('title')}
                    onBlur={() => setFocused(null)}
                    maxLength={LIVE_TITLE_MAX}
                    returnKeyType="next"
                    error={titleErrorText}
                    accessibilityHint={t('studio.info.liveTitle')}
                    testID="studio-title"
                />
            </View>

            <View style={styles.field}>
                <FieldLabel label={t('studio.info.tags')} hint={t('studio.go.tagsCount', { count: form.tags.length, max: LIVE_TAGS_MAX })} />
                <Panel>
                    {form.tags.length === 0 ? (
                        <Text style={styles.empty}>{t('studio.info.tags')}</Text>
                    ) : (
                        <View style={styles.chips}>
                            {form.tags.map((tag) => (
                                <Chip key={tag} label={tag} active onPress={() => handleTag(onToggleTag(tag))} style={styles.chip} testID={`selected-tag-${tag}`} />
                            ))}
                        </View>
                    )}
                    {tagNotice ? <Notice tone="warning">{t('studio.go.tagsLimit', { max: LIVE_TAGS_MAX })}</Notice> : null}

                    {TAG_GROUPS.map((group) => {
                        const open = openGroup === group.key;
                        return (
                            <View key={group.key} style={styles.group}>
                                <Pressable
                                    onPress={() => setOpenGroup(open ? '' : group.key)}
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: open }}
                                    style={styles.groupHeader}
                                    testID={`tag-group-${group.key}`}
                                >
                                    <Text style={styles.groupTitle}>{t(group.key)}</Text>
                                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                                </Pressable>
                                {open ? (
                                    <View style={[styles.chips, styles.groupBody]}>
                                        {group.tags.map((tag) => (
                                            <Chip
                                                key={tag}
                                                label={tag}
                                                active={form.tags.includes(tag)}
                                                onPress={() => handleTag(onToggleTag(tag))}
                                                style={styles.chip}
                                                testID={`tag-${tag}`}
                                            />
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}

                    <AddRow
                        value={customTag}
                        onChangeText={setCustomTag}
                        onAdd={submitCustomTag}
                        placeholder={t('studio.info.addTag')}
                        addLabel={t('studio.info.addTagBtn')}
                        testID="custom-tag"
                        maxLength={40}
                    />
                </Panel>
            </View>

            <View style={styles.field}>
                <FieldLabel label={t('studio.info.level')} />
                <View style={styles.chips}>
                    {LEVELS.map((level) => (
                        <Chip key={level} label={t(LEVEL_KEYS[level])} active={form.level === level} onPress={() => onChange({ level })} style={styles.chip} testID={`level-${level}`} />
                    ))}
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
    help: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
    },
    empty: {
        color: colors.placeholder,
        fontSize: 13,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        minHeight: 44,
    },
    group: {
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    groupHeader: {
        minHeight: 44,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    groupTitle: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    groupBody: {
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
}));
