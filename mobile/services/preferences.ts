import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type NotificationChannel = 'site' | 'email' | 'mobile';

export type NotificationPreferences = {
    global: boolean;
    lives: boolean;
    reminders: boolean;
    promotions: boolean;
    channel: NotificationChannel;
};

export type AppPreferences = {
    region: string;
    timezone: string;
    notifications: NotificationPreferences;
};

const PREFERENCES_KEY = 'app_preferences';

const DEFAULT_PREFERENCES: AppPreferences = {
    region: 'France',
    timezone: '(GMT+1) Europe / Paris',
    notifications: {
        global: true,
        lives: true,
        reminders: true,
        promotions: false,
        channel: 'site',
    },
};

const storage = {
    async setItem(key: string, value: string): Promise<void> {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    },
    async getItem(key: string): Promise<string | null> {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        }
        return SecureStore.getItemAsync(key);
    },
};

const resolveChannel = (channel: string | undefined): NotificationChannel => {
    if (channel === 'email' || channel === 'mobile' || channel === 'site') {
        return channel;
    }
    return 'site';
};

const mergePreferences = (
    current: AppPreferences,
    next: Partial<AppPreferences> & { notifications?: Partial<NotificationPreferences> }
): AppPreferences => {
    const mergedNotifications = next.notifications
        ? { ...current.notifications, ...next.notifications }
        : current.notifications;

    const merged: AppPreferences = {
        ...current,
        ...next,
        notifications: {
            ...mergedNotifications,
            channel: resolveChannel(next.notifications?.channel ?? current.notifications.channel),
        },
    };

    return merged;
};

class PreferencesService {
    private cached: AppPreferences | null = null;

    async getPreferences(): Promise<AppPreferences> {
        if (this.cached) {
            return this.cached;
        }

        const raw = await storage.getItem(PREFERENCES_KEY);
        if (!raw) {
            this.cached = DEFAULT_PREFERENCES;
            return this.cached;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<AppPreferences>;
            const merged = mergePreferences(DEFAULT_PREFERENCES, parsed);
            this.cached = merged;
            return merged;
        } catch {
            this.cached = DEFAULT_PREFERENCES;
            return this.cached;
        }
    }

    async setPreferences(next: Partial<AppPreferences> & { notifications?: Partial<NotificationPreferences> }): Promise<AppPreferences> {
        const current = await this.getPreferences();
        const merged = mergePreferences(current, next);
        this.cached = merged;
        await storage.setItem(PREFERENCES_KEY, JSON.stringify(merged));
        return merged;
    }

    async getNotificationPreferences(): Promise<NotificationPreferences> {
        const prefs = await this.getPreferences();
        return prefs.notifications;
    }
}

const preferencesService = new PreferencesService();

export default preferencesService;
