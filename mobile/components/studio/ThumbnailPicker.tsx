import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { IconButton, Notice, Panel, StudioInput } from '@/components/studio/primitives';
import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { THUMBNAIL_MAX_BYTES, type PickedImage } from '@/services/studio';

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Backend accepts jpg/png/gif/webp by file extension: anything else is sent as a jpg (the picker re-encodes it). */
export function toPickedImage(asset: ImagePicker.ImagePickerAsset): PickedImage {
    const mimeType = asset.mimeType && EXTENSIONS[asset.mimeType] ? asset.mimeType : 'image/jpeg';
    return {
        uri: asset.uri,
        mimeType,
        name: `thumbnail.${EXTENSIONS[mimeType]}`,
        size: asset.fileSize,
    };
}

type Props = {
    image: PickedImage | null;
    imageUrl: string;
    onPick: (image: PickedImage) => void;
    onClear: () => void;
    onUrlChange: (url: string) => void;
    disabled?: boolean;
};

/** Thumbnail step: pick a photo (uploaded on submit) or paste an image URL. */
export default function ThumbnailPicker({ image, imageUrl, onPick, onClear, onUrlChange, disabled }: Readonly<Props>) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useStyles();
    const [error, setError] = useState('');

    const choose = async () => {
        setError('');
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            if (asset.fileSize && asset.fileSize > THUMBNAIL_MAX_BYTES) {
                setError(t('studio.broadcast.imageTooLarge'));
                return;
            }
            onPick(toPickedImage(asset));
        } catch {
            setError(t('studio.broadcast.imagePickError'));
        }
    };

    return (
        <Panel>
            <Button
                label={image ? t('studio.broadcast.changeImage') : t('studio.broadcast.chooseImageDevice')}
                variant="secondary"
                onPress={choose}
                disabled={disabled}
                icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.text} />}
                testID="thumbnail-choose"
            />
            <Text style={styles.formats}>{t('studio.broadcast.fileFormats')}</Text>
            {error ? <Notice tone="error" testID="thumbnail-error">{error}</Notice> : null}

            {image ? (
                <View style={styles.picked} testID="thumbnail-picked">
                    <Image source={{ uri: image.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
                    <View style={styles.pickedText}>
                        <Text style={styles.pickedName} numberOfLines={1}>
                            {image.name}
                        </Text>
                        {image.size ? <Text style={styles.pickedSize}>{`${(image.size / 1024 / 1024).toFixed(2)} Mo`}</Text> : null}
                    </View>
                    <IconButton icon="close" label={t('studio.broadcast.removeImageAria')} tone="quiet" onPress={onClear} testID="thumbnail-remove" />
                </View>
            ) : null}

            <Text style={styles.orPaste}>{t('studio.broadcast.orPasteUrl')}</Text>
            <StudioInput
                value={imageUrl}
                onChangeText={onUrlChange}
                placeholder={t('studio.broadcast.imagePlaceholder')}
                accessibilityLabel={t('studio.broadcast.thumbnail')}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                testID="thumbnail-url"
            />
        </Panel>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    formats: {
        color: colors.muted,
        fontSize: 12,
        textAlign: 'center',
    },
    picked: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: radii.md,
        backgroundColor: colors.orangeSoft,
    },
    thumb: {
        width: 64,
        height: 40,
        borderRadius: radii.sm,
        backgroundColor: colors.surfaceStrong,
    },
    pickedText: {
        flex: 1,
        minWidth: 0,
    },
    pickedName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    pickedSize: {
        color: colors.muted,
        fontSize: 12,
    },
    orPaste: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
}));
