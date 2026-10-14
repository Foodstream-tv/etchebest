/** Catalog tags shared with the web (front-web `watch/page.tsx` TAGS and `HomeHero.tsx` TAG_GROUPS). */

export const ALL_TAG = 'Tout';

/** Separator used to pass several tags in one route param (`tags=Asiatique|Healthy`). */
export const TAGS_SEPARATOR = '|';

/** Tag chips of the Lives / Replays screens. */
export const LIVE_TAGS = [
  'Asiatique',
  'Africain',
  'Européen',
  'Américain',
  'Français',
  'Italien',
  'Coréen',
  'Japonais',
  'Végétarien',
  'Pâtisserie',
  'Street Food',
  'BBQ',
  'Healthy',
] as const;

export type TagGroupKey = 'cuisine' | 'dishType' | 'format';

/** Filter groups of the Home hero (web `HomeFiltersSelect`). `labelKey` is a shared i18n key. */
export const TAG_GROUPS: ReadonlyArray<{
  key: TagGroupKey;
  labelKey: 'home.hero.group.cuisine' | 'home.hero.group.dishType' | 'home.hero.group.format';
  icon: 'globe-outline' | 'leaf-outline' | 'restaurant-outline';
  tags: readonly string[];
}> = [
  {
    key: 'cuisine',
    labelKey: 'home.hero.group.cuisine',
    icon: 'globe-outline',
    tags: ['Asiatique', 'Africain', 'Européen', 'Américain', 'Français', 'Italien', 'Mexicain', 'Japonais', 'Coréen', 'Chinois', 'Indien'],
  },
  {
    key: 'dishType',
    labelKey: 'home.hero.group.dishType',
    icon: 'leaf-outline',
    tags: ['Végétarien', 'Vegan', 'Pâtisserie', 'Dessert', 'Street Food', 'BBQ', 'Healthy', 'Apéro', 'Petit-déjeuner', 'Boisson'],
  },
  {
    key: 'format',
    labelKey: 'home.hero.group.format',
    icon: 'restaurant-outline',
    tags: ['Recette rapide', 'Pas à pas', 'Débutant friendly', 'Meal prep', 'Cuisine économique', 'Challenge', 'Fait maison'],
  },
];

/** Home "Explorer par cuisine" cards (web `HomeCuisineCategories`). */
export const HOME_CATEGORIES = [
  { tag: 'Asiatique', emoji: '🍜', labelKey: 'home.categories.asian', descKey: 'home.categories.asianDesc' },
  { tag: 'Pâtisserie', emoji: '🧁', labelKey: 'home.categories.pastry', descKey: 'home.categories.pastryDesc' },
  { tag: 'BBQ', emoji: '🔥', labelKey: 'home.categories.bbq', descKey: 'home.categories.bbqDesc' },
  { tag: 'Healthy', emoji: '🥗', labelKey: 'home.categories.healthy', descKey: 'home.categories.healthyDesc' },
] as const;
