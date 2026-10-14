import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import { TAG_GROUPS } from '@/constants/tags';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';

type FiltersSheetProps = {
    visible: boolean;
    value: readonly string[];
    onClose: () => void;
    onApply: (tags: string[]) => void;
};

/** Bottom sheet with the web hero filter groups (cuisine / dish type / format), multi-select. */
export default function FiltersSheet({ visible, value, onClose, onApply }: Readonly<FiltersSheetProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const [draft, setDraft] = useState<string[]>([...value]);

    // Re-sync the draft every time the sheet opens.
    useEffect(() => {
        if (visible) setDraft([...value]);
    }, [visible, value]);

    const toggle = (tag: string) =>
        setDraft((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={t('home.hero.closeFilters')} accessibilityRole="button" />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} accessibilityViewIsModal>
                <View style={styles.handle} />
                <View style={styles.header}>
                    <View style={styles.headerTexts}>
                        <Text style={styles.title} accessibilityRole="header">
                            {t('home.hero.filters')}
                        </Text>
                        <Text style={styles.description}>{t('home.hero.filtersDescription')}</Text>
                    </View>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('home.hero.closeFilters')}>
                        <Ionicons name="close" size={24} color={colors.muted} />
                    </Pressable>
                </View>

                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                    {TAG_GROUPS.map((group) => (
                        <View key={group.key} style={styles.group} accessibilityLabel={t('home.hero.filtersAria', { group: t(group.labelKey) })}>
                            <View style={styles.groupHeader}>
                                <Ionicons name={group.icon} size={16} color={colors.orangeText} />
                                <Text style={styles.groupTitle}>{t(group.labelKey)}</Text>
                            </View>
                            <View style={styles.chips}>
                                {group.tags.map((tag) => (
                                    <Chip key={tag} label={tag} active={draft.includes(tag)} onPress={() => toggle(tag)} testID={`filter-${tag}`} />
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.footer}>
                    <Button label={t('home.hero.resetFilters')} variant="secondary" onPress={() => setDraft([])} style={styles.footerButton} />
                    <Button
                        label={t('home.hero.applyFilters')}
                        onPress={() => {
                            onApply(draft);
                            onClose();
                        }}
                        style={styles.footerButtonWide}
                    />
                </View>
            </View>
        </Modal>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
    },
    sheet: {
        maxHeight: '80%',
        backgroundColor: colors.cardSolid,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderColor: colors.border,
        borderWidth: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 8,
    },
    headerTexts: {
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700',
    },
    description: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 2,
    },
    scroll: {
        flexGrow: 0,
    },
    group: {
        marginTop: 16,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    groupTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    footer: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
    footerButton: {
        flex: 1,
    },
    footerButtonWide: {
        flex: 2,
    },
}));
