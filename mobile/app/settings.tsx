import BrandBackdrop from '@/components/BrandBackdrop';
import { brandTheme } from '@/constants/brandTheme';
import { LanguageProvider, useI18n } from '@/contexts/LanguageContext';
import { createShadowStyle } from '@/utils/shadow';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../services/api';
import { authService, StoredUser } from '../services/auth';
import preferencesService from '../services/preferences';

const ORANGE_GRADIENT = brandTheme.gradients.primary;
const PRIMARY = brandTheme.colors.orange;
const BORDER = brandTheme.colors.border;
const CARD = brandTheme.colors.surface;
const SURFACE_STRONG = brandTheme.colors.surfaceStrong;
const BACKGROUND = brandTheme.colors.bg;
const MUTED = brandTheme.colors.muted;
const TEXT = brandTheme.colors.text;

type ThemeMode = 'clair' | 'sombre' | 'systeme';
type NotificationChannel = 'site' | 'email' | 'mobile';

export default function SettingsScreen() {
  return (
    <LanguageProvider>
      <SettingsScreenContent />
    </LanguageProvider>
  );
}


const FieldBox = ({ label, value, trailing }: { label: string; value: string; trailing?: React.ReactNode }) => (
  <View style={styles.fieldBox}>
    <Text style={styles.settingLabel}>{label}</Text>
    <View style={styles.fieldInput}>
      <Text style={styles.fieldValue}>{value}</Text>
      {trailing}
    </View>
  </View>
);

const OptionPill = ({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.optionPill, selected && styles.optionPillSelected]}>
    <Ionicons name={icon} size={16} color={selected ? '#FF7A00' : '#565b66'} />
    <Text style={[styles.optionPillText, selected && styles.optionPillTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

const GradientToggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onToggle} style={styles.toggleWrapper}>
      <LinearGradient
        colors={value ? ORANGE_GRADIENT : ['rgba(250, 245, 238, 0.16)', 'rgba(250, 245, 238, 0.1)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.toggleTrack, value ? null : styles.toggleTrackOff]}>
        <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
      </LinearGradient>
    </TouchableOpacity>
  );
};

const ChannelCard = ({
  title,
  description,
  icon,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.channelWrapper}>
      <LinearGradient
        colors={selected ? ORANGE_GRADIENT : [SURFACE_STRONG, SURFACE_STRONG]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.channelCard, selected && styles.channelCardActive]}>
        <View style={[styles.channelInner, selected && styles.channelInnerActive]}>
          <Ionicons name={icon} size={18} color={selected ? '#fff' : MUTED} />
          <View style={styles.channelTextGroup}>
            <Text style={[styles.channelTitle, selected && styles.channelTitleActive]}>{title}</Text>
            <Text style={[styles.channelDescription, selected && styles.channelDescriptionActive]}>{description}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const HeaderBackdrop = () => (
  <View style={styles.headerBackdrop}>
    <LinearGradient
      colors={['rgba(12, 8, 4, 0.96)', 'rgba(12, 8, 4, 0)']}
      style={StyleSheet.absoluteFillObject}
    />
    <View style={styles.headerDivider} />
  </View>
);

const SettingsCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) => (
  <View style={styles.innerCard}>
    <View style={styles.innerCardHeader}>
      <Text style={styles.innerCardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.innerCardSubtitle}>{subtitle}</Text> : null}
    </View>
    <View style={styles.innerCardBody}>{children}</View>
  </View>
);

const CollapsibleSection = ({
  title,
  subtitle,
  children,
  defaultExpanded = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={MUTED} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sectionBody}>
          <View style={styles.divider} />
          <View style={styles.sectionContent}>{children}</View>
        </View>
      )}
    </View>
  );
};

function SettingsScreenContent() {
  const { locale, setLocale } = useI18n();
  const isEn = locale === 'en';
  const tr = useCallback((frText: string, enText: string) => (isEn ? enText : frText), [isEn]);
  const [user, setUser] = useState<StoredUser | null>(null);

  const router = useRouter();
  const [themeMode, setThemeMode] = useState('clair' as ThemeMode);
  const [region, setRegion] = useState('France');
  const [timezone, setTimezone] = useState('(GMT+1) Europe / Paris');
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;

    document.documentElement.style.backgroundColor = BACKGROUND;
    document.body.style.backgroundColor = BACKGROUND;

    return () => {
      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, []);

  const language = tr('Francais', 'English');

  useEffect(() => {
    let isMounted = true;

    const loadUserData = async () => {
      try {
        const storedUser = await authService.getUser();
        if (isMounted) {
          setUser(storedUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      }

      try {
        const token = await authService.getToken();
        if (!token) {
          return;
        }

        const profile = await apiService.getProfile(token);
        if (!isMounted) {
          return;
        }

        setUser((previousUser) => ({
          id: profile.id,
          email: profile.email,
          username: profile.username,
          firstName: profile.firstName || previousUser?.firstName,
          lastName: profile.lastName || previousUser?.lastName,
          description: profile.description || previousUser?.description,
        }));
        setPasswordUpdatedAt(profile.passwordUpdatedAt ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPasswordUpdatedAt(null);

        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const shouldResetSession =
          message.includes('user not found') ||
          message.includes('unauthorized') ||
          message.includes('missing or invalid token');

        if (!shouldResetSession) {
          return;
        }

        try {
          await authService.logout();
        } finally {
          setUser(null);
          router.replace('/login' as any);
        }
      }
    };

    void loadUserData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const notSetValue = tr('Non renseigne', 'Not set');
  const displayName =
    [user?.firstName?.trim(), user?.lastName?.trim()].filter(Boolean).join(' ') ||
    user?.username ||
    notSetValue;
  const usernameValue = user?.username ? `@${user.username}` : notSetValue;
  const emailValue = user?.email || notSetValue;

  const copy = isEn
    ? {
      headerTitle: 'Settings',
      heroEyebrow: 'SETTINGS',
      heroTitle: 'Configure everything on Foodstream',
      sectionAccountTitle: 'Account & Profile',
      sectionAccountSubtitle: 'Manage your identity and account access.',
      sectionInterfaceTitle: 'Interface & Theme',
      sectionInterfaceSubtitle: 'Customize the overall Foodstream look and feel.',
      sectionNotificationsTitle: 'Notifications',
      sectionNotificationsSubtitle: 'Choose which alerts you want to receive.',
      sectionPrivacyTitle: 'Privacy & Security',
      sectionPrivacySubtitle: 'Control what you share and who can access it.',
      sectionPlaybackTitle: 'Playback & Lives',
      sectionPlaybackSubtitle: 'Adjust your viewing and chat experience.',
      sectionAdvancedTitle: 'Advanced settings',
      sectionAdvancedSubtitle: 'Enable options for power users.',
      cardMainInfoTitle: 'Main information',
      cardMainInfoSubtitle: 'This information is shown on your profile.',
      cardSecurityTitle: 'Security',
      cardSecuritySubtitle: 'Protect your Foodstream profile.',
      cardDangerTitle: 'Danger zone',
      cardDangerSubtitle: 'Permanent actions on your account.',
      cardThemeTitle: 'Theme',
      cardThemeSubtitle: 'Choose how Foodstream adapts.',
      cardLanguageTitle: 'Language & region',
      cardLanguageSubtitle: 'Date, time and content formats.',
      cardNotifGeneralTitle: 'General notifications',
      cardNotifGeneralSubtitle: 'Enable or disable all alerts.',
      cardNotifLivesTitle: 'New lives',
      cardNotifLivesSubtitle: 'Stay informed about your followed chefs.',
      cardNotifRemindersTitle: 'Live reminders',
      cardNotifRemindersSubtitle: "Don't miss a live you planned.",
      cardNotifPromosTitle: 'Promotions & news',
      cardNotifPromosSubtitle: 'Stay informed about Foodstream updates.',
      cardNotifChannelsTitle: 'Notification channels',
      cardNotifChannelsSubtitle: 'Where do you want to receive alerts?',
      cardPrivacyTitle: 'Privacy & security',
      cardPrivacySubtitle: 'Decide which information stays private.',
      cardSessionsTitle: 'Sessions & devices',
      cardSessionsSubtitle: 'Track where your account is connected.',
      cardVideoTitle: 'Video playback',
      cardVideoSubtitle: 'Optimize quality and playback comfort.',
      cardChatTitle: 'Live chat',
      cardChatSubtitle: 'Moderate and personalize live chat.',
      cardBetaTitle: 'Experience & beta',
      cardBetaSubtitle: 'Test new features first.',
      cardDataTitle: 'Data & privacy',
      cardDataSubtitle: 'Manage collection and data exports.',
      languageLabel: 'Language',
      timezoneLabel: 'Timezone',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeSystem: 'System',
      themeHelper: 'Dark mode is recommended for watching lives at night.',
      themeRenderHelp: 'Select the rendering that suits you best.',
    }
    : {
      headerTitle: 'Parametres',
      heroEyebrow: 'PARAMETRES',
      heroTitle: 'Tout configurer sur Foodstream',
      sectionAccountTitle: 'Compte & Profil',
      sectionAccountSubtitle: 'Gere ton identite et l acces a ton compte.',
      sectionInterfaceTitle: 'Interface & Theme',
      sectionInterfaceSubtitle: 'Personnalise l apparence generale de Foodstream.',
      sectionNotificationsTitle: 'Notifications',
      sectionNotificationsSubtitle: 'Choisis ce que tu veux recevoir comme alertes.',
      sectionPrivacyTitle: 'Confidentialite & Securite',
      sectionPrivacySubtitle: 'Controle ce que tu partages et qui y accede.',
      sectionPlaybackTitle: 'Lecture & Lives',
      sectionPlaybackSubtitle: 'Ajuste l experience de visionnage et de chat.',
      sectionAdvancedTitle: 'Parametres avances',
      sectionAdvancedSubtitle: 'Active les options destinees aux power users.',
      cardMainInfoTitle: 'Informations principales',
      cardMainInfoSubtitle: 'Ces informations s affichent sur ton profil.',
      cardSecurityTitle: 'Securite',
      cardSecuritySubtitle: 'Protege ton profil Foodstream.',
      cardDangerTitle: 'Danger zone',
      cardDangerSubtitle: 'Actions definitives sur ton compte.',
      cardThemeTitle: 'Theme',
      cardThemeSubtitle: 'Choisis comment Foodstream s adapte.',
      cardLanguageTitle: 'Langue & region',
      cardLanguageSubtitle: 'Formats de date, d heure et de contenus.',
      cardNotifGeneralTitle: 'Notifications generales',
      cardNotifGeneralSubtitle: 'Active ou coupe l ensemble des alertes.',
      cardNotifLivesTitle: 'Nouveaux lives',
      cardNotifLivesSubtitle: 'Reste au courant des lives des chefs suivis.',
      cardNotifRemindersTitle: 'Rappel avant live',
      cardNotifRemindersSubtitle: 'Ne rate pas un live que tu as planifie.',
      cardNotifPromosTitle: 'Promotions & nouveautes',
      cardNotifPromosSubtitle: 'Reste informe des nouveautes Foodstream.',
      cardNotifChannelsTitle: 'Canaux de notification',
      cardNotifChannelsSubtitle: 'Ou veux-tu recevoir les alertes ?',
      cardPrivacyTitle: 'Confidentialite & securite',
      cardPrivacySubtitle: 'Decide quelles informations restent privees.',
      cardSessionsTitle: 'Sessions & appareils',
      cardSessionsSubtitle: 'Surveille ou ton compte est connecte.',
      cardVideoTitle: 'Lecture video',
      cardVideoSubtitle: 'Optimise la qualite et le confort de lecture.',
      cardChatTitle: 'Chat en direct',
      cardChatSubtitle: 'Modere et personnalise le chat du live.',
      cardBetaTitle: 'Experience & beta',
      cardBetaSubtitle: 'Test les nouveautes avant tout le monde.',
      cardDataTitle: 'Donnees & confidentialite',
      cardDataSubtitle: 'Gere la collecte et l export de tes donnees.',
      languageLabel: 'Langue',
      timezoneLabel: 'Fuseau horaire',
      themeLight: 'Clair',
      themeDark: 'Sombre',
      themeSystem: 'Systeme',
      themeHelper: 'Le mode sombre est recommande pour regarder des lives la nuit.',
      themeRenderHelp: 'Selectionne le rendu qui te convient le mieux.',
    };

  const handleLogout = useCallback(async () => {
    await authService.logout();
    router.replace('/login' as any);
  }, [router]);

  const handleChangeLocale = useCallback((nextLocale: 'fr' | 'en') => {
    setLocale(nextLocale).catch(() => {
      // Keep current locale if persistence fails.
    });
  }, [setLocale]);

  const handleSelectRegion = useCallback((nextRegion: string) => {
    setRegion(nextRegion);
    if (nextRegion === 'United Kingdom') {
      setTimezone('(GMT+0) Europe / London');
      return;
    }
    setTimezone('(GMT+1) Europe / Paris');
  }, []);

  const [channels, setChannels] = useState('site' as NotificationChannel);
  const [twoFactor, setTwoFactor] = useState(true);

  const [globalNotifications, setGlobalNotifications] = useState(true);
  const [notifyLives, setNotifyLives] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyPromotions, setNotifyPromotions] = useState(false);

  const [publicProfile, setPublicProfile] = useState(true);
  const [shareActivity, setShareActivity] = useState(true);
  const [shareLocation, setShareLocation] = useState(false);
  const [sessionAlerts, setSessionAlerts] = useState(true);

  const sessionDevices: { id: string; name: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      id: 'iphone',
      name: 'iPhone 15 Pro',
      detail: tr('Connecte il y a 2 h • Paris', 'Connected 2h ago • Paris'),
      icon: 'phone-portrait-outline',
    },
    {
      id: 'web',
      name: tr('Chrome sur macOS', 'Chrome on macOS'),
      detail: tr('Actif maintenant • Lyon', 'Active now • Lyon'),
      icon: 'desktop-outline',
    },
  ];

  const [videoAutoplay, setVideoAutoplay] = useState(true);
  const [videoHD, setVideoHD] = useState(true);
  const [videoCaptions, setVideoCaptions] = useState(false);

  const [chatSlowMode, setChatSlowMode] = useState(false);
  const [chatHighlights, setChatHighlights] = useState(true);
  const [chatFilter, setChatFilter] = useState(true);

  const [betaAccess, setBetaAccess] = useState(true);
  const [experimentalUI, setExperimentalUI] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const preferences = await preferencesService.getPreferences();
        if (!isMounted) {
          return;
        }

        setRegion(preferences.region);
        setTimezone(preferences.timezone);
        setChannels(preferences.notifications.channel as NotificationChannel);
        setGlobalNotifications(preferences.notifications.global);
        setNotifyLives(preferences.notifications.lives);
        setNotifyReminders(preferences.notifications.reminders);
        setNotifyPromotions(preferences.notifications.promotions);
      } finally {
        if (isMounted) {
          setHasLoadedPreferences(true);
        }
      }
    };

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }

    preferencesService.setPreferences({
      region,
      timezone,
      notifications: {
        channel: channels,
        global: globalNotifications,
        lives: notifyLives,
        reminders: notifyReminders,
        promotions: notifyPromotions,
      },
    }).catch(() => {
      // Keep UI responsive even if persistence fails.
    });
  }, [
    channels,
    globalNotifications,
    hasLoadedPreferences,
    notifyLives,
    notifyPromotions,
    notifyReminders,
    region,
    timezone,
  ]);

  const passwordLastUpdatedLabel = (() => {
    if (!passwordUpdatedAt) {
      return tr('Derniere modification indisponible.', 'Last change unavailable.');
    }

    const parsedDate = new Date(passwordUpdatedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return tr('Derniere modification indisponible.', 'Last change unavailable.');
    }

    const formattedDate = new Intl.DateTimeFormat(isEn ? 'en-GB' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate);

    return isEn
      ? `Last changed on ${formattedDate}`
      : `Derniere modification le ${formattedDate}`;
  })();

  const openPasswordModal = useCallback(() => {
    setPasswordError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModalVisible(true);
  }, []);

  const closePasswordModal = useCallback(() => {
    if (isUpdatingPassword) {
      return;
    }
    setPasswordModalVisible(false);
    setPasswordError(null);
  }, [isUpdatingPassword]);

  const handleUpdatePassword = useCallback(async () => {
    if (!currentPassword.trim()) {
      setPasswordError(tr('Mot de passe actuel requis.', 'Current password is required.'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(tr('Le nouveau mot de passe doit contenir au moins 8 caracteres.', 'New password must be at least 8 characters.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(tr('La confirmation ne correspond pas.', 'Password confirmation does not match.'));
      return;
    }

    const token = await authService.getToken();
    if (!token) {
      setPasswordError(tr('Session expiree, reconnecte-toi.', 'Session expired, please sign in again.'));
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError(null);

    try {
      const response = await apiService.updatePassword(token, {
        currentPassword,
        newPassword,
      });

      setPasswordUpdatedAt(response.passwordUpdatedAt || new Date().toISOString());
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : tr('Impossible de modifier le mot de passe.', 'Unable to update password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  }, [confirmPassword, currentPassword, newPassword, tr]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      tr('Supprimer le compte', 'Delete account'),
      tr('Cette action est irreversible et supprimera toutes tes donnees.', 'This action is irreversible and will delete all your data.'),
      [
        { text: tr('Annuler', 'Cancel'), style: 'cancel' },
        {
          text: tr('Supprimer', 'Delete'),
          style: 'destructive',
          onPress: () => {
            const runDelete = async () => {
              if (isDeletingAccount) {
                return;
              }

              setIsDeletingAccount(true);
              try {
                const token = await authService.getToken();
                if (!token) {
                  throw new Error(tr('Session expiree, reconnecte-toi.', 'Session expired, please sign in again.'));
                }

                await apiService.deleteCurrentUser(token);
                await authService.logout();
                router.replace('/login' as any);
              } catch (error) {
                Alert.alert(
                  tr('Erreur', 'Error'),
                  error instanceof Error ? error.message : tr('Impossible de supprimer le compte.', 'Unable to delete account.')
                );
              } finally {
                setIsDeletingAccount(false);
              }
            };

            void runDelete();
          },
        },
      ]
    );
  }, [isDeletingAccount, router, tr]);

  return (
    <>
      <Stack.Screen
        options={{
          title: copy.headerTitle,
          headerTintColor: TEXT,
          headerStyle: { backgroundColor: BACKGROUND },
          headerTransparent: true,
          headerBackground: HeaderBackdrop,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
        <BrandBackdrop compact />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.heroIconBg}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </LinearGradient>
            </View>
            <View>
              <Text style={styles.heroEyebrow}>{copy.heroEyebrow}</Text>
              <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
            </View>
          </View>

          <CollapsibleSection title={copy.sectionAccountTitle} subtitle={copy.sectionAccountSubtitle}>
            <SettingsCard title={copy.cardMainInfoTitle} subtitle={copy.cardMainInfoSubtitle}>
              <View style={styles.cardContent}>
                <FieldBox label={tr('Nom affiche', 'Display name')} value={displayName} />
                <FieldBox label={tr('Pseudo', 'Username')} value={usernameValue} />
                <FieldBox label={tr('Adresse e-mail', 'Email address')} value={emailValue} />
                <FieldBox
                  label={tr('Pays / region', 'Country / region')}
                  value={region}
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardSecurityTitle} subtitle={copy.cardSecuritySubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Mot de passe', 'Password')}</Text>
                  <Text style={styles.settingDescription}>{passwordLastUpdatedLabel}</Text>
                </View>
                <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={openPasswordModal}>
                  <Text style={styles.secondaryButtonText}>{tr('Modifier', 'Edit')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <View style={styles.recoTagStandalone}>
                    <LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.recoTagBg}>
                      <Text style={styles.recoTagText}>{tr('Recommande', 'Recommended')}</Text>
                    </LinearGradient>
                  </View>
                  <Text style={styles.settingLabel}>{tr('Authentification a deux facteurs', 'Two-factor authentication')}</Text>
                  <Text style={styles.settingDescription}>{tr('Ajoute une couche de securite via ton telephone.', 'Add an extra security layer with your phone.')}</Text>
                </View>
                <GradientToggle value={twoFactor} onToggle={() => setTwoFactor((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardDangerTitle} subtitle={copy.cardDangerSubtitle}>
              <View style={styles.dangerRow}>
                <View style={styles.settingText}>
                  <View style={styles.dangerLabelRow}>
                    <Ionicons name="trash-outline" size={18} color="#D92B2B" />
                    <Text style={styles.dangerText}>{tr('Supprimer mon compte', 'Delete my account')}</Text>
                  </View>
                  <Text style={styles.settingDescription}>{tr('Toutes tes donnees Foodstream seront definitivement supprimees.', 'All your Foodstream data will be permanently deleted.')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.dangerButton, isDeletingAccount && styles.buttonDisabled]}
                  activeOpacity={0.9}
                  onPress={handleDeleteAccount}
                  disabled={isDeletingAccount}>
                  <Text style={styles.dangerButtonText}>
                    {isDeletingAccount ? tr('Suppression...', 'Deleting...') : tr('Supprimer', 'Delete')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.dangerRow}>
                <View style={styles.settingText}>
                  <View style={styles.dangerLabelRow}>
                    <Ionicons name="log-out-outline" size={18} color={TEXT} />
                    <Text style={styles.settingLabel}>{tr('Deconnexion globale', 'Global logout')}</Text>
                  </View>
                  <Text style={styles.settingDescription}>{tr('Deconnecte ton compte de tous les appareils.', 'Sign out your account from all devices.')}</Text>
                </View>
                <TouchableOpacity style={styles.ghostButton} activeOpacity={0.9} onPress={handleLogout}>
                  <Text style={styles.ghostButtonText}>{tr('Deconnecter', 'Sign out')}</Text>
                </TouchableOpacity>
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title={copy.sectionInterfaceTitle} subtitle={copy.sectionInterfaceSubtitle}>
            <SettingsCard title={copy.cardThemeTitle} subtitle={copy.cardThemeSubtitle}>
              <Text style={styles.settingDescription}>{copy.themeRenderHelp}</Text>
              <View style={styles.optionRow}>
                <OptionPill label={copy.themeLight} icon="sunny-outline" selected={themeMode === 'clair'} onPress={() => setThemeMode('clair')} />
                <OptionPill label={copy.themeDark} icon="moon-outline" selected={themeMode === 'sombre'} onPress={() => setThemeMode('sombre')} />
                <OptionPill label={copy.themeSystem} icon="laptop-outline" selected={themeMode === 'systeme'} onPress={() => setThemeMode('systeme')} />
              </View>
              <Text style={styles.helperText}>{copy.themeHelper}</Text>
            </SettingsCard>

            <SettingsCard title={copy.cardLanguageTitle} subtitle={copy.cardLanguageSubtitle}>
              <View style={styles.cardContent}>
                <FieldBox
                  label={copy.languageLabel}
                  value={language}
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
                <FieldBox
                  label={copy.timezoneLabel}
                  value={timezone}
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
                <FieldBox
                  label={tr('Region', 'Region')}
                  value={region}
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
                <View style={styles.optionRow}>
                  <OptionPill
                    label="Francais"
                    icon="language-outline"
                    selected={locale === 'fr'}
                    onPress={() => handleChangeLocale('fr')}
                  />
                  <OptionPill
                    label="English"
                    icon="language-outline"
                    selected={locale === 'en'}
                    onPress={() => handleChangeLocale('en')}
                  />
                </View>
                <View style={styles.optionRow}>
                  <OptionPill
                    label={tr('France', 'France')}
                    icon="flag-outline"
                    selected={region === 'France'}
                    onPress={() => handleSelectRegion('France')}
                  />
                  <OptionPill
                    label={tr('Royaume-Uni', 'United Kingdom')}
                    icon="flag-outline"
                    selected={region === 'United Kingdom'}
                    onPress={() => handleSelectRegion('United Kingdom')}
                  />
                </View>
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title={copy.sectionNotificationsTitle} subtitle={copy.sectionNotificationsSubtitle}>
            <SettingsCard title={copy.cardNotifGeneralTitle} subtitle={copy.cardNotifGeneralSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Recevoir les notifications', 'Receive notifications')}</Text>
                  <Text style={styles.settingDescription}>{tr('Inclut les emails, push et alertes in-app.', 'Includes email, push, and in-app alerts.')}</Text>
                </View>
                <GradientToggle value={globalNotifications} onToggle={() => setGlobalNotifications((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardNotifLivesTitle} subtitle={copy.cardNotifLivesSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Alerte nouveaux lives', 'New live alerts')}</Text>
                  <Text style={styles.settingDescription}>{tr('Quand un chef que tu suis planifie ou demarre un live.', 'When a chef you follow schedules or starts a live.')}</Text>
                </View>
                <GradientToggle value={notifyLives} onToggle={() => setNotifyLives((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardNotifRemindersTitle} subtitle={copy.cardNotifRemindersSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Rappel 10 min avant', 'Reminder 10 min before')}</Text>
                  <Text style={styles.settingDescription}>{tr('Notifications pour les lives ajoutes a ton planning.', 'Notifications for lives added to your schedule.')}</Text>
                </View>
                <GradientToggle value={notifyReminders} onToggle={() => setNotifyReminders((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardNotifPromosTitle} subtitle={copy.cardNotifPromosSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Promotions et annonces', 'Promotions and announcements')}</Text>
                  <Text style={styles.settingDescription}>{tr('Nouvelles fonctionnalites, evenements speciaux, offres exclusives.', 'New features, special events, exclusive offers.')}</Text>
                </View>
                <GradientToggle value={notifyPromotions} onToggle={() => setNotifyPromotions((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardNotifChannelsTitle} subtitle={copy.cardNotifChannelsSubtitle}>
              <View style={styles.channelGrid}>
                <ChannelCard
                  title={tr('Sur le site', 'On-site')}
                  description={tr('Notifications in-app', 'In-app notifications')}
                  icon="notifications-outline"
                  selected={channels === 'site'}
                  onPress={() => setChannels('site')}
                />
                <ChannelCard
                  title={tr('Email', 'Email')}
                  description={tr('Resume et rappels', 'Digests and reminders')}
                  icon="mail-outline"
                  selected={channels === 'email'}
                  onPress={() => setChannels('email')}
                />
                <ChannelCard
                  title={tr('Mobile', 'Mobile')}
                  description={tr('Push sur l app', 'Push on the app')}
                  icon="phone-portrait-outline"
                  selected={channels === 'mobile'}
                  onPress={() => setChannels('mobile')}
                />
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title={copy.sectionPrivacyTitle} subtitle={copy.sectionPrivacySubtitle}>
            <SettingsCard title={copy.cardPrivacyTitle} subtitle={copy.cardPrivacySubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Profil public', 'Public profile')}</Text>
                  <Text style={styles.settingDescription}>{tr('Ton profil est visible par tous sur Foodstream.', 'Your profile is visible to everyone on Foodstream.')}</Text>
                </View>
                <GradientToggle value={publicProfile} onToggle={() => setPublicProfile((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Partager mon activite', 'Share my activity')}</Text>
                  <Text style={styles.settingDescription}>{tr('Affiche les lives que tu regardes en ce moment.', 'Shows the lives you are watching right now.')}</Text>
                </View>
                <GradientToggle value={shareActivity} onToggle={() => setShareActivity((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Partager ma localisation', 'Share my location')}</Text>
                  <Text style={styles.settingDescription}>{tr('Utilise pour recommander des lives proches de toi.', 'Used to recommend nearby lives.')}</Text>
                </View>
                <GradientToggle value={shareLocation} onToggle={() => setShareLocation((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardSessionsTitle} subtitle={copy.cardSessionsSubtitle}>
              <View style={styles.sessionList}>
                {sessionDevices.map((device) => (
                  <View key={device.id} style={styles.sessionItem}>
                    <View style={styles.sessionIcon}>
                      <Ionicons name={device.icon} size={18} color={TEXT} />
                    </View>
                    <View style={styles.sessionMeta}>
                      <Text style={styles.settingLabel}>{device.name}</Text>
                      <Text style={styles.settingDescription}>{device.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Alertes de connexion', 'Login alerts')}</Text>
                  <Text style={styles.settingDescription}>{tr('Previens-moi lorsqu un nouvel appareil se connecte.', 'Notify me when a new device signs in.')}</Text>
                </View>
                <GradientToggle value={sessionAlerts} onToggle={() => setSessionAlerts((value) => !value)} />
              </View>
              <TouchableOpacity style={styles.linkButton} activeOpacity={0.85}>
                <Text style={styles.linkButtonText}>{tr('Gerer les sessions actives', 'Manage active sessions')}</Text>
              </TouchableOpacity>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title={copy.sectionPlaybackTitle} subtitle={copy.sectionPlaybackSubtitle}>
            <SettingsCard title={copy.cardVideoTitle} subtitle={copy.cardVideoSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Lecture automatique', 'Autoplay')}</Text>
                  <Text style={styles.settingDescription}>{tr('Lance les lives des qu ils commencent.', 'Starts lives as soon as they begin.')}</Text>
                </View>
                <GradientToggle value={videoAutoplay} onToggle={() => setVideoAutoplay((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Toujours en HD', 'Always in HD')}</Text>
                  <Text style={styles.settingDescription}>{tr('Forcer la haute definition quand disponible.', 'Force high definition when available.')}</Text>
                </View>
                <GradientToggle value={videoHD} onToggle={() => setVideoHD((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Sous-titres automatiques', 'Automatic subtitles')}</Text>
                  <Text style={styles.settingDescription}>{tr('Affiche les sous-titres generes automatiquement.', 'Shows automatically generated subtitles.')}</Text>
                </View>
                <GradientToggle value={videoCaptions} onToggle={() => setVideoCaptions((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardChatTitle} subtitle={copy.cardChatSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Mode lent', 'Slow mode')}</Text>
                  <Text style={styles.settingDescription}>{tr('Limite l envoi de messages a un toutes les 15 secondes.', 'Limits message sending to one every 15 seconds.')}</Text>
                </View>
                <GradientToggle value={chatSlowMode} onToggle={() => setChatSlowMode((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Mettre en avant les mentions', 'Highlight mentions')}</Text>
                  <Text style={styles.settingDescription}>{tr('Met en evidence les messages qui te mentionnent.', 'Highlights messages that mention you.')}</Text>
                </View>
                <GradientToggle value={chatHighlights} onToggle={() => setChatHighlights((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Filtre automatique', 'Automatic filter')}</Text>
                  <Text style={styles.settingDescription}>{tr('Masque automatiquement les messages offensants.', 'Automatically hides offensive messages.')}</Text>
                </View>
                <GradientToggle value={chatFilter} onToggle={() => setChatFilter((value) => !value)} />
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title={copy.sectionAdvancedTitle} subtitle={copy.sectionAdvancedSubtitle}>
            <SettingsCard title={copy.cardBetaTitle} subtitle={copy.cardBetaSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Programme beta', 'Beta program')}</Text>
                  <Text style={styles.settingDescription}>{tr('Recois les fonctionnalites en avant-premiere.', 'Get early access to features.')}</Text>
                </View>
                <GradientToggle value={betaAccess} onToggle={() => setBetaAccess((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Interface experimentale', 'Experimental interface')}</Text>
                  <Text style={styles.settingDescription}>{tr('Active les nouveaux layouts en cours de test.', 'Enables new layouts under test.')}</Text>
                </View>
                <GradientToggle value={experimentalUI} onToggle={() => setExperimentalUI((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title={copy.cardDataTitle} subtitle={copy.cardDataSubtitle}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>{tr('Autoriser les analytics', 'Allow analytics')}</Text>
                  <Text style={styles.settingDescription}>{tr('Aide-nous a ameliorer Foodstream en partageant des donnees anonymisees.', 'Help us improve Foodstream by sharing anonymized data.')}</Text>
                </View>
                <GradientToggle value={analyticsConsent} onToggle={() => setAnalyticsConsent((value) => !value)} />
              </View>
              <View style={styles.cardActionRow}>
                <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
                  <Text style={styles.secondaryButtonText}>{tr('Exporter mes donnees', 'Export my data')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} activeOpacity={0.9}>
                  <Text style={styles.ghostButtonText}>{tr('Reinitialiser les recommandations', 'Reset recommendations')}</Text>
                </TouchableOpacity>
              </View>
            </SettingsCard>
          </CollapsibleSection>
        </ScrollView>

        <Modal
          animationType="fade"
          transparent
          visible={passwordModalVisible}
          onRequestClose={closePasswordModal}>
          <View style={styles.passwordModalBackdrop}>
            {Platform.OS === 'web' ? null : <BlurView intensity={44} tint="dark" style={styles.passwordModalBlur} />}
            <View style={styles.passwordModalBackdropTint} />
            <View style={styles.passwordModalCard}>
              <View style={styles.passwordModalHeader}>
                <Text style={styles.passwordModalTitle}>{tr('Modifier le mot de passe', 'Update password')}</Text>
                <TouchableOpacity onPress={closePasswordModal} disabled={isUpdatingPassword}>
                  <Ionicons name="close" size={20} color={TEXT} />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordModalBody}>
                <View style={styles.passwordInputGroup}>
                  <Text style={styles.passwordInputLabel}>{tr('Mot de passe actuel', 'Current password')}</Text>
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder={tr('Entrez votre mot de passe actuel', 'Enter your current password')}
                    placeholderTextColor={MUTED}
                    style={styles.passwordInput}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.passwordInputGroup}>
                  <Text style={styles.passwordInputLabel}>{tr('Nouveau mot de passe', 'New password')}</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder={tr('Au moins 8 caracteres', 'At least 8 characters')}
                    placeholderTextColor={MUTED}
                    style={styles.passwordInput}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.passwordInputGroup}>
                  <Text style={styles.passwordInputLabel}>{tr('Confirmer le mot de passe', 'Confirm password')}</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={tr('Confirmez le nouveau mot de passe', 'Confirm the new password')}
                    placeholderTextColor={MUTED}
                    style={styles.passwordInput}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {passwordError ? <Text style={styles.passwordErrorText}>{passwordError}</Text> : null}

              <View style={styles.passwordModalActions}>
                <TouchableOpacity
                  style={styles.passwordSecondaryButton}
                  activeOpacity={0.9}
                  onPress={closePasswordModal}
                  disabled={isUpdatingPassword}>
                  <Text style={styles.passwordSecondaryButtonText}>{tr('Annuler', 'Cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.passwordPrimaryButton, isUpdatingPassword && styles.passwordPrimaryButtonDisabled]}
                  activeOpacity={0.9}
                  onPress={handleUpdatePassword}
                  disabled={isUpdatingPassword}>
                  <LinearGradient
                    colors={ORANGE_GRADIENT}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.passwordPrimaryGradient}>
                    <Text style={styles.passwordPrimaryButtonText}>
                      {isUpdatingPassword ? tr('Enregistrement...', 'Saving...') : tr('Enregistrer', 'Save')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 64,
    gap: 14,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SURFACE_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  headerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
  },
  headerDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: BORDER,
    opacity: 1,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    ...createShadowStyle({
      color: '#00000010',
      offset: { width: 0, height: 6 },
      opacity: 0.1,
      radius: 10,
      elevation: 2,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionBody: {
    marginTop: 16,
    gap: 16,
  },
  sectionContent: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 13,
  },
  innerCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  innerCardHeader: {
    gap: 4,
  },
  innerCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  innerCardSubtitle: {
    fontSize: 12,
    color: MUTED,
  },
  innerCardBody: {
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
  },
  helperText: {
    fontSize: 12,
    color: MUTED,
  },
  cardContent: {
    gap: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 6,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'nowrap',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  settingDescription: {
    fontSize: 12,
    color: MUTED,
  },
  toggleWrapper: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 16,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOff: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TEXT,
    ...createShadowStyle({
      color: '#00000020',
      offset: { width: 0, height: 1 },
      opacity: 0.2,
      radius: 2,
    }),
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    alignSelf: 'flex-start',
  },
  channelGrid: {
    gap: 10,
  },
  channelWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  channelCard: {
    borderRadius: 14,
    padding: 1,
  },
  channelCardActive: {
    ...createShadowStyle({
      color: '#FF7A0020',
      offset: { width: 0, height: 4 },
      opacity: 0.2,
      radius: 8,
    }),
  },
  channelInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE_STRONG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 13,
  },
  channelInnerActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  channelTextGroup: {
    flex: 1,
  },
  channelTitle: {
    fontWeight: '700',
    color: TEXT,
  },
  channelTitleActive: {
    color: TEXT,
  },
  channelDescription: {
    fontSize: 12,
    color: MUTED,
  },
  channelDescriptionActive: {
    color: MUTED,
  },
  recoTagBg: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  recoTagStandalone: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  recoTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  fieldBox: {
    gap: 6,
  },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_STRONG,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValue: {
    color: TEXT,
    fontWeight: '600',
  },
  optionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_STRONG,
    minWidth: 0,
  },
  optionPillSelected: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
  },
  optionPillText: {
    color: TEXT,
    fontWeight: '700',
  },
  optionPillTextSelected: {
    color: '#FF7A00',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: SURFACE_STRONG,
  },
  secondaryButtonText: {
    color: TEXT,
    fontWeight: '700',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  dangerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dangerText: {
    color: '#D92B2B',
    fontWeight: '700',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: brandTheme.colors.danger,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.14)',
  },
  dangerButtonText: {
    color: '#D92B2B',
    fontWeight: '700',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: SURFACE_STRONG,
  },
  ghostButtonText: {
    color: TEXT,
    fontWeight: '700',
  },
  sessionList: {
    gap: 12,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  sessionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: SURFACE_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionMeta: {
    flex: 1,
    gap: 2,
  },
  linkButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  linkButtonText: {
    color: '#FF7A00',
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  passwordModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  passwordModalBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  passwordModalBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 10, 8, 0.36)',
  },
  passwordModalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: 'rgba(12, 8, 4, 0.86)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
    ...createShadowStyle({
      color: '#0000001C',
      offset: { width: 0, height: 8 },
      opacity: 0.14,
      radius: 16,
      elevation: 3,
    }),
  },
  passwordModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  passwordModalBody: {
    gap: 10,
  },
  passwordInputGroup: {
    gap: 6,
  },
  passwordInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: SURFACE_STRONG,
    color: TEXT,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  passwordModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  passwordSecondaryButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: SURFACE_STRONG,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  passwordSecondaryButtonText: {
    color: TEXT,
    fontWeight: '600',
  },
  passwordPrimaryButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  passwordPrimaryButtonDisabled: {
    opacity: 0.72,
  },
  passwordPrimaryGradient: {
    minWidth: 118,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});