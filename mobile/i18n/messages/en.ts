import fr from './fr';

type TranslationMessages = {
    [K in keyof typeof fr]: string;
};

const en: TranslationMessages = {
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

    'profile.title': 'Profile',
    'profile.section.preferences': 'Preferences',
    'profile.section.stats': 'Statistics',
    'profile.section.badges': 'Medals & Badges',
    'profile.section.connections': 'Connected accounts',
    'profile.section.activity': 'Recent activity',

    'profile.edit.button': 'Edit',
    'profile.edit.modalTitle': 'Edit my profile',
    'profile.edit.firstName': 'First name',
    'profile.edit.lastName': 'Last name',
    'profile.edit.username': 'Username',
    'profile.edit.email': 'Email',
    'profile.edit.bio': 'Bio',
    'profile.edit.placeholder.firstName': 'Enter your first name',
    'profile.edit.placeholder.lastName': 'Enter your last name',
    'profile.edit.placeholder.username': 'Enter your username',
    'profile.edit.placeholder.email': 'email@example.com',
    'profile.edit.placeholder.bio': 'Tell us about yourself',
    'profile.edit.error.firstNameRequired': 'First name is required.',
    'profile.edit.error.lastNameRequired': 'Last name is required.',
    'profile.edit.error.usernameMin': 'Username must be at least 3 characters long.',
    'profile.edit.error.emailRequired': 'Email is required.',
    'profile.edit.error.emailInvalid': 'Invalid email address.',
    'profile.edit.error.updateFailed': 'Unable to update profile.',
    'profile.edit.alert.sessionTitle': 'Session expired',
    'profile.edit.alert.sessionMessage': 'Please sign in again to edit your profile.',

    'profile.preferences.theme': 'Theme',
    'profile.preferences.theme.light': 'Light',
    'profile.preferences.theme.dark': 'Dark',
    'profile.preferences.theme.system': 'System',
    'profile.preferences.theme.helper': 'Toggle to try dark mode',
    'profile.preferences.notifications': 'Notifications',
    'profile.preferences.notifications.lives': 'Lives',
    'profile.preferences.notifications.replays': 'Replays',
    'profile.preferences.notifications.newChefs': 'New chefs',
    'profile.preferences.language': 'Language',

    'profile.stats.watchTime': 'Watch time',
    'profile.stats.recipes': 'Recipes cooked',
    'profile.stats.streak': 'Streak',
    'profile.stats.streakValue': '7 days',
    'profile.stats.followedChefs': 'Followed chefs',
    'profile.progress.level': 'Chef level',
    'profile.progress.weeklyGoal': 'Weekly goal (5h)',

    'profile.badges.beginner.title': 'Beginner chef',
    'profile.badges.beginner.description': '5 lives watched',
    'profile.badges.curious.title': 'Curious gourmet',
    'profile.badges.curious.description': '10 recipes saved',
    'profile.badges.chatKing.title': 'Chat king',
    'profile.badges.chatKing.description': '100 messages sent',
    'profile.badges.earlyBird.title': 'Early bird',
    'profile.badges.earlyBird.description': '3 lives at 8am',
    'profile.badges.nightOwl.title': 'Night owl',
    'profile.badges.nightOwl.description': '3 lives after midnight',
    'profile.badges.ambassador.title': 'Ambassador',
    'profile.badges.ambassador.description': '5 referrals',

    'profile.activity.item1': 'Joined "Ultimate Tonkotsu Ramen"',
    'profile.activity.item2': 'Saved "Super fluffy bao buns"',
    'profile.activity.item3': 'Followed chef "Camille Dupont"',
};

export default en;
