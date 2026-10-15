import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CookingAssistant from '@/components/cooking/CookingAssistant';
import KeepAwake from '@/components/cooking/KeepAwake';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { type CookingProgress } from '@/hooks/useCookingProgress';
import { type CookingRecipe } from '@/utils/recipe';

type Props = {
    visible: boolean;
    recipe: CookingRecipe;
    progress: CookingProgress;
    onClose: () => void;
};

/** Full-screen recipe over the broadcast: the camera stays connected underneath, closing returns to the live. */
export default function RecipeModal({ visible, recipe, progress, onClose }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} testID="recipe-modal">
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <Text style={styles.title} accessibilityRole="header">
                        {t('live.tab.recipe')}
                    </Text>
                    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8} style={styles.close} testID="recipe-close">
                        <Ionicons name="close" size={24} color={colors.text} />
                    </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.content}>
                    {visible ? <KeepAwake /> : null}
                    <CookingAssistant recipe={recipe} progress={progress} />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    safe: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
    },
    close: {
        width: 44,
        height: 44,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceStrong,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
}));
