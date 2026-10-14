/**
 * Quick tags of the web Studio (`TAG_GROUPS`). They are content, sent as-is to the backend
 * (`POST /rooms { tags }` creates the missing ones), so they are not translated.
 */
export const TAG_GROUPS = [
    {
        key: 'studio.go.tagGroup.cuisine',
        tags: [
            'Asiatique', 'Africain', 'Américain', 'Européen', 'Français', 'Italien',
            'Mexicain', 'Japonais', 'Coréen', 'Chinois', 'Indien', 'Méditerranéen',
        ],
    },
    {
        key: 'studio.go.tagGroup.dish',
        tags: [
            'Pâtisserie', 'Dessert', 'Végétarien', 'Vegan', 'Healthy', 'Street food',
            'BBQ', 'Petit-déjeuner', 'Apéro', 'Plat familial', 'Snack', 'Boisson',
        ],
    },
    {
        key: 'studio.go.tagGroup.format',
        tags: [
            'Recette rapide', 'Pas à pas', 'Débutant friendly', 'Meal prep', 'Batch cooking',
            'Challenge', 'Cuisine économique', 'Sans four', 'Air fryer', 'Fait maison',
        ],
    },
] as const;
