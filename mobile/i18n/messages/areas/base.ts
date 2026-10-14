// Mobile-only keys that predate the web alignment (tabs, generic labels).
// Profile / settings wording lives in ./profile.ts and ./settings.ts.
export const fr = {
    'common.user': 'Utilisateur',
    'common.connected': 'Connecté',
    'common.link': 'Lier',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.languages.fr': 'FR',
    'common.languages.en': 'EN',

    'tabs.home': 'Accueil',
    'tabs.discover': 'Découvrir',
    'tabs.favorites': 'Favoris',
    'tabs.profile': 'Profil',
} as const;

export const en: Record<keyof typeof fr, string> = {
    'common.user': 'User',
    'common.connected': 'Connected',
    'common.link': 'Link',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.languages.fr': 'FR',
    'common.languages.en': 'EN',

    'tabs.home': 'Home',
    'tabs.discover': 'Discover',
    'tabs.favorites': 'Favorites',
    'tabs.profile': 'Profile',
};
