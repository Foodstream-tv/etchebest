import { Platform, Share } from 'react-native';

const FILE_NAME = 'foodstream-my-data.json';

/**
 * Hands the personal data export to the user: a file download on web, the system share sheet
 * (save to Files, mail it to oneself…) on native, where no file-system module is bundled.
 */
export async function shareMyData(data: unknown, title: string): Promise<void> {
    const json = JSON.stringify(data, null, 2);

    if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = FILE_NAME;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return;
    }

    await Share.share({ title, message: json });
}
