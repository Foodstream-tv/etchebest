// Mobile-only keys for the Home / Lives / Replays / Search screens.
// Everything the web also says (home.*, watch.*, replays.*, nav.*) comes from shared.{fr,en}.ts.
export const fr = {
    'home.creators.heading': 'Chefs à découvrir',
    'home.creators.subtitle': 'Les créateurs derrière les lives du moment.',
    'home.creators.tag': 'Créateurs',
    'home.filters.activeCount': '{count} filtre{plural} actif{plural}',
    'home.liveNow.tag': 'En direct',
    'lives.loadMoreError': 'Impossible de charger la suite.',
    'lives.statusFilterAria': 'Filtrer par statut',
    'search.title': 'Recherche',
    'search.hint': 'Tape le nom d’un chef ou d’un live pour commencer.',
    'search.openAria': 'Ouvrir la recherche',
    'search.livesHeading': 'Lives',
    'search.error': 'La recherche a échoué.',
    'replays.noReplayYet': 'Pas encore de rediffusion',
} as const;

export const en: Record<keyof typeof fr, string> = {
    'home.creators.heading': 'Chefs to discover',
    'home.creators.subtitle': 'The creators behind today’s lives.',
    'home.creators.tag': 'Creators',
    'home.filters.activeCount': '{count} active filter{plural}',
    'home.liveNow.tag': 'Live',
    'lives.loadMoreError': 'Unable to load more.',
    'lives.statusFilterAria': 'Filter by status',
    'search.title': 'Search',
    'search.hint': 'Type the name of a chef or a live to get started.',
    'search.openAria': 'Open search',
    'search.livesHeading': 'Lives',
    'search.error': 'Search failed.',
    'replays.noReplayYet': 'No replay yet',
};
