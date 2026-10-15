import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Notice, StudioInput } from '@/components/studio/primitives';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { scrapeMarmiton } from '@/services/studio';
import { hasImportableRecipe, type MarmitonRecipe } from '@/utils/studioRecipe';

/** "marmiton.org/..." without scheme is accepted: the backend only fetches https pages. */
export function normalizeRecipeUrl(raw: string): string {
    const url = raw.trim();
    if (!url) return '';
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

type Props = {
    /** Called with the imported recipe and the page it comes from. */
    onImported: (recipe: MarmitonRecipe, sourceUrl: string) => void;
};

/** Dashed "Import a Marmiton recipe" card at the top of step 1 (web `studio.marmiton.*`). */
export default function MarmitonImport({ onImported }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const [url, setUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const inFlight = useRef(false);

    const handleImport = async () => {
        const target = normalizeRecipeUrl(url);
        if (!target || inFlight.current) return;
        inFlight.current = true;
        setImporting(true);
        setError('');
        setSuccess('');
        try {
            const recipe = await scrapeMarmiton(target);
            if (!hasImportableRecipe(recipe)) {
                // Only a title came back (article, home page…): not a recipe, nothing is filled in.
                setError(t('studio.marmiton.noRecipe'));
                return;
            }
            onImported(recipe, target);
            setUrl('');
            setSuccess(t('studio.marmiton.success'));
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            setError(message || t('studio.marmiton.errorGeneric'));
        } finally {
            inFlight.current = false;
            setImporting(false);
        }
    };

    return (
        <View style={styles.box} testID="marmiton-import">
            <View style={styles.titleRow}>
                <View style={styles.sparkle}>
                    <Ionicons name="sparkles" size={16} color={colors.onBrand} />
                </View>
                <Text style={styles.title} accessibilityRole="header">
                    {t('studio.marmiton.title')}
                </Text>
            </View>
            <Text style={styles.subtitle}>{t('studio.marmiton.subtitle')}</Text>

            <StudioInput
                value={url}
                onChangeText={setUrl}
                placeholder={t('studio.marmiton.placeholder')}
                accessibilityLabel={t('studio.marmiton.title')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleImport}
                editable={!importing}
                testID="marmiton-url"
            />
            <Button
                label={importing ? t('studio.marmiton.importing') : t('studio.marmiton.btn')}
                onPress={handleImport}
                loading={importing}
                disabled={!url.trim()}
                testID="marmiton-import-button"
            />

            {error ? <Notice tone="error" testID="marmiton-error">{error}</Notice> : null}
            {success ? (
                <View style={styles.successBox} testID="marmiton-success">
                    <Notice tone="success">{`✓ ${success}`}</Notice>
                    <Text style={styles.tip}>{`📸 ${t('studio.marmiton.imageTip')}`}</Text>
                </View>
            ) : null}

            <Text style={styles.disclaimer}>{`ℹ️ ${t('studio.marmiton.disclaimer')}`}</Text>
        </View>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    box: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: colors.orangeGlow,
        backgroundColor: colors.orangeSoft,
        borderRadius: radii.card,
        padding: 16,
        gap: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sparkle: {
        width: 32,
        height: 32,
        borderRadius: radii.md,
        backgroundColor: colors.orange,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    subtitle: {
        color: colors.muted,
        fontSize: 13,
        lineHeight: 19,
    },
    successBox: {
        gap: 6,
    },
    tip: {
        color: colors.muted,
        fontSize: 12,
        lineHeight: 17,
    },
    disclaimer: {
        color: colors.placeholder,
        fontSize: 11,
        lineHeight: 16,
    },
}));
