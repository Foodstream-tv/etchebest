import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ORANGE_GRADIENT = ['#FFA92E', '#FF5D1E'] as const;
const BORDER = '#E7E7EC';
const CARD = '#FFFFFF';
const MUTED = '#7B8294';
const TEXT = '#1F2430';

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
        colors={value ? ORANGE_GRADIENT : ['#dcdde2', '#cfd1d7']}
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
        colors={selected ? ORANGE_GRADIENT : ['#f7f7f9', '#f7f7f9']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.channelCard, selected && styles.channelCardActive]}>
        <View style={[styles.channelInner, selected && styles.channelInnerActive]}>
          <Ionicons name={icon} size={18} color={selected ? '#fff' : '#50525a'} />
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
      colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0)']}
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

export default function SettingsScreen() {
  const [themeMode, setThemeMode] = useState<'clair' | 'sombre' | 'systeme'>('clair');
  const language = 'Français';
  const timezone = '(GMT+1) Europe / Paris';

  const [channels, setChannels] = useState<'site' | 'email' | 'mobile'>('site');
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
    { id: 'iphone', name: 'iPhone 15 Pro', detail: 'Connecté il y a 2 h • Paris', icon: 'phone-portrait-outline' },
    { id: 'web', name: 'Chrome sur macOS', detail: 'Actif maintenant • Lyon', icon: 'desktop-outline' },
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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Paramètres',
          headerTintColor: '#1F2430',
          headerStyle: { backgroundColor: 'white' },
          headerTransparent: true,
          headerBackground: HeaderBackdrop,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.heroIconBg}>
                <Ionicons name="settings-outline" size={20} color="#fff" />
              </LinearGradient>
            </View>
            <View>
              <Text style={styles.heroEyebrow}>PARAMÈTRES</Text>
              <Text style={styles.heroTitle}>Tout configurer sur Foodstream</Text>
            </View>
          </View>

          <CollapsibleSection title="Compte & Profil" subtitle="Gère ton identité et l’accès à ton compte.">
            <SettingsCard title="Informations principales" subtitle="Ces informations s’affichent sur ton profil.">
              <View style={styles.cardContent}>
                <FieldBox label="Nom affiché" value="Nicolas Loiseau" />
                <FieldBox label="Pseudo" value="@nicolas" />
                <FieldBox label="Adresse e-mail" value="nicolas@example.com" />
                <FieldBox
                  label="Pays / région"
                  value="France"
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
              </View>
            </SettingsCard>

            <SettingsCard title="Sécurité" subtitle="Protège ton profil Foodstream.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Mot de passe</Text>
                  <Text style={styles.settingDescription}>Dernière modification il y a 3 mois.</Text>
                </View>
                <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
                  <Text style={styles.secondaryButtonText}>Modifier</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <View style={styles.recoTagStandalone}>
                    <LinearGradient colors={ORANGE_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.recoTagBg}>
                      <Text style={styles.recoTagText}>Recommandé</Text>
                    </LinearGradient>
                  </View>
                  <Text style={styles.settingLabel}>Authentification à deux facteurs</Text>
                  <Text style={styles.settingDescription}>Ajoute une couche de sécurité via ton téléphone.</Text>
                </View>
                <GradientToggle value={twoFactor} onToggle={() => setTwoFactor((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Danger zone" subtitle="Actions définitives sur ton compte.">
              <View style={styles.dangerRow}>
                <View style={styles.settingText}>
                  <View style={styles.dangerLabelRow}>
                    <Ionicons name="trash-outline" size={18} color="#D92B2B" />
                    <Text style={styles.dangerText}>Supprimer mon compte</Text>
                  </View>
                  <Text style={styles.settingDescription}>Toutes tes données Foodstream seront définitivement supprimées.</Text>
                </View>
                <TouchableOpacity style={styles.dangerButton} activeOpacity={0.9}>
                  <Text style={styles.dangerButtonText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.dangerRow}>
                <View style={styles.settingText}>
                  <View style={styles.dangerLabelRow}>
                    <Ionicons name="log-out-outline" size={18} color={TEXT} />
                    <Text style={styles.settingLabel}>Déconnexion globale</Text>
                  </View>
                  <Text style={styles.settingDescription}>Déconnecte ton compte de tous les appareils.</Text>
                </View>
                <TouchableOpacity style={styles.ghostButton} activeOpacity={0.9}>
                  <Text style={styles.ghostButtonText}>Déconnecter</Text>
                </TouchableOpacity>
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title="Interface & Thème" subtitle="Personnalise l’apparence générale de Foodstream.">
            <SettingsCard title="Thème" subtitle="Choisis comment Foodstream s’adapte.">
              <Text style={styles.settingDescription}>Sélectionne le rendu qui te convient le mieux.</Text>
              <View style={styles.optionRow}>
                <OptionPill label="Clair" icon="sunny-outline" selected={themeMode === 'clair'} onPress={() => setThemeMode('clair')} />
                <OptionPill label="Sombre" icon="moon-outline" selected={themeMode === 'sombre'} onPress={() => setThemeMode('sombre')} />
                <OptionPill label="Système" icon="laptop-outline" selected={themeMode === 'systeme'} onPress={() => setThemeMode('systeme')} />
              </View>
              <Text style={styles.helperText}>Le mode sombre est recommandé pour regarder des lives la nuit.</Text>
            </SettingsCard>

            <SettingsCard title="Langue & région" subtitle="Formats de date, d’heure et de contenus.">
              <View style={styles.cardContent}>
                <FieldBox
                  label="Langue"
                  value={language}
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
                <FieldBox
                  label="Fuseau horaire"
                  value={timezone}
                  trailing={<Ionicons name="chevron-down" size={16} color={MUTED} />}
                />
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title="Notifications" subtitle="Choisis ce que tu veux recevoir comme alertes.">
            <SettingsCard title="Notifications générales" subtitle="Active ou coupe l’ensemble des alertes.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Recevoir les notifications</Text>
                  <Text style={styles.settingDescription}>Inclut les emails, push et alertes in-app.</Text>
                </View>
                <GradientToggle value={globalNotifications} onToggle={() => setGlobalNotifications((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Nouveaux lives" subtitle="Reste au courant des lives des chefs suivis.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Alerte nouveaux lives</Text>
                  <Text style={styles.settingDescription}>Quand un chef que tu suis planifie ou démarre un live.</Text>
                </View>
                <GradientToggle value={notifyLives} onToggle={() => setNotifyLives((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Rappel avant live" subtitle="Ne rate pas un live que tu as planifié.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Rappel 10 min avant</Text>
                  <Text style={styles.settingDescription}>Notifications pour les lives ajoutés à ton planning.</Text>
                </View>
                <GradientToggle value={notifyReminders} onToggle={() => setNotifyReminders((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Promotions & nouveautés" subtitle="Reste informé des nouveautés Foodstream.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Promotions et annonces</Text>
                  <Text style={styles.settingDescription}>Nouvelles fonctionnalités, événements spéciaux, offres exclusives.</Text>
                </View>
                <GradientToggle value={notifyPromotions} onToggle={() => setNotifyPromotions((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Canaux de notification" subtitle="Où veux-tu recevoir les alertes ?">
              <View style={styles.channelGrid}>
                <ChannelCard
                  title="Sur le site"
                  description="Notifications in-app"
                  icon="notifications-outline"
                  selected={channels === 'site'}
                  onPress={() => setChannels('site')}
                />
                <ChannelCard
                  title="Email"
                  description="Résumé et rappels"
                  icon="mail-outline"
                  selected={channels === 'email'}
                  onPress={() => setChannels('email')}
                />
                <ChannelCard
                  title="Mobile"
                  description="Push sur l’app"
                  icon="phone-portrait-outline"
                  selected={channels === 'mobile'}
                  onPress={() => setChannels('mobile')}
                />
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title="Confidentialité & Sécurité" subtitle="Contrôle ce que tu partages et qui y accède.">
            <SettingsCard title="Confidentialité & sécurité" subtitle="Décide quelles informations restent privées.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Profil public</Text>
                  <Text style={styles.settingDescription}>Ton profil est visible par tous sur Foodstream.</Text>
                </View>
                <GradientToggle value={publicProfile} onToggle={() => setPublicProfile((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Partager mon activité</Text>
                  <Text style={styles.settingDescription}>Affiche les lives que tu regardes en ce moment.</Text>
                </View>
                <GradientToggle value={shareActivity} onToggle={() => setShareActivity((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Partager ma localisation</Text>
                  <Text style={styles.settingDescription}>Utilisé pour recommander des lives proches de toi.</Text>
                </View>
                <GradientToggle value={shareLocation} onToggle={() => setShareLocation((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Sessions & appareils" subtitle="Surveille où ton compte est connecté.">
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
                  <Text style={styles.settingLabel}>Alertes de connexion</Text>
                  <Text style={styles.settingDescription}>Préviens-moi lorsqu’un nouvel appareil se connecte.</Text>
                </View>
                <GradientToggle value={sessionAlerts} onToggle={() => setSessionAlerts((value) => !value)} />
              </View>
              <TouchableOpacity style={styles.linkButton} activeOpacity={0.85}>
                <Text style={styles.linkButtonText}>Gérer les sessions actives</Text>
              </TouchableOpacity>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title="Lecture & Lives" subtitle="Ajuste l’expérience de visionnage et de chat.">
            <SettingsCard title="Lecture vidéo" subtitle="Optimise la qualité et le confort de lecture.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Lecture automatique</Text>
                  <Text style={styles.settingDescription}>Lance les lives dès qu’ils commencent.</Text>
                </View>
                <GradientToggle value={videoAutoplay} onToggle={() => setVideoAutoplay((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Toujours en HD</Text>
                  <Text style={styles.settingDescription}>Forcer la haute définition quand disponible.</Text>
                </View>
                <GradientToggle value={videoHD} onToggle={() => setVideoHD((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Sous-titres automatiques</Text>
                  <Text style={styles.settingDescription}>Affiche les sous-titres générés automatiquement.</Text>
                </View>
                <GradientToggle value={videoCaptions} onToggle={() => setVideoCaptions((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Chat en direct" subtitle="Modère et personnalise le chat du live.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Mode lent</Text>
                  <Text style={styles.settingDescription}>Limite l’envoi de messages à un toutes les 15 secondes.</Text>
                </View>
                <GradientToggle value={chatSlowMode} onToggle={() => setChatSlowMode((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Mettre en avant les mentions</Text>
                  <Text style={styles.settingDescription}>Met en évidence les messages qui te mentionnent.</Text>
                </View>
                <GradientToggle value={chatHighlights} onToggle={() => setChatHighlights((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Filtre automatique</Text>
                  <Text style={styles.settingDescription}>Masque automatiquement les messages offensants.</Text>
                </View>
                <GradientToggle value={chatFilter} onToggle={() => setChatFilter((value) => !value)} />
              </View>
            </SettingsCard>
          </CollapsibleSection>

          <CollapsibleSection title="Paramètres avancés" subtitle="Active les options destinées aux power users.">
            <SettingsCard title="Expérience & bêta" subtitle="Test les nouveautés avant tout le monde.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Programme bêta</Text>
                  <Text style={styles.settingDescription}>Reçois les fonctionnalités en avant-première.</Text>
                </View>
                <GradientToggle value={betaAccess} onToggle={() => setBetaAccess((value) => !value)} />
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Interface expérimentale</Text>
                  <Text style={styles.settingDescription}>Active les nouveaux layouts en cours de test.</Text>
                </View>
                <GradientToggle value={experimentalUI} onToggle={() => setExperimentalUI((value) => !value)} />
              </View>
            </SettingsCard>

            <SettingsCard title="Données & confidentialité" subtitle="Gère la collecte et l’export de tes données.">
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Autoriser les analytics</Text>
                  <Text style={styles.settingDescription}>Aide-nous à améliorer Foodstream en partageant des données anonymisées.</Text>
                </View>
                <GradientToggle value={analyticsConsent} onToggle={() => setAnalyticsConsent((value) => !value)} />
              </View>
              <View style={styles.cardActionRow}>
                <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9}>
                  <Text style={styles.secondaryButtonText}>Exporter mes données</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} activeOpacity={0.9}>
                  <Text style={styles.ghostButtonText}>Réinitialiser les recommandations</Text>
                </TouchableOpacity>
              </View>
            </SettingsCard>
          </CollapsibleSection>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8FB',
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
    backgroundColor: '#FFEFE0',
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
    backgroundColor: '#E4E6ED',
    opacity: 0.7,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#00000010',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
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
    borderColor: '#EBECF0',
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
    backgroundColor: '#F0F0F3',
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
    backgroundColor: '#ECEEF3',
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
    borderColor: '#d2d4db',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#00000020',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
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
    shadowColor: '#FF7A0020',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  channelInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f7f7f9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 13,
  },
  channelInnerActive: {
    backgroundColor: '#fff6ec',
  },
  channelTextGroup: {
    flex: 1,
  },
  channelTitle: {
    fontWeight: '700',
    color: '#50525a',
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
    borderColor: '#d9d9df',
    backgroundColor: '#fafafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldValue: {
    color: '#444',
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
    borderColor: '#d9d9df',
    backgroundColor: '#fff',
    minWidth: 0,
  },
  optionPillSelected: {
    borderColor: '#FF7A00',
    backgroundColor: '#FFF6EC',
  },
  optionPillText: {
    color: '#565b66',
    fontWeight: '700',
  },
  optionPillTextSelected: {
    color: '#FF7A00',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D1D5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#2c2f38',
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
    borderColor: '#D92B2B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF5F5',
  },
  dangerButtonText: {
    color: '#D92B2B',
    fontWeight: '700',
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: '#D0D1D5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  ghostButtonText: {
    color: '#2c2f38',
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
    backgroundColor: '#F4F5F7',
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
});
