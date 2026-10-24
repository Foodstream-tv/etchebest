/** Tags offered when describing a live, by category. A custom tag can always be typed in. */
export const TAG_GROUPS = [
  {
    title: "Cuisine",
    tags: [
      "Asiatique",
      "Africain",
      "Américain",
      "Européen",
      "Français",
      "Italien",
      "Mexicain",
      "Japonais",
      "Coréen",
      "Chinois",
      "Indien",
      "Méditerranéen",
    ],
  },
  {
    title: "Type de plat",
    tags: [
      "Pâtisserie",
      "Dessert",
      "Végétarien",
      "Vegan",
      "Healthy",
      "Street food",
      "BBQ",
      "Petit-déjeuner",
      "Apéro",
      "Plat familial",
      "Snack",
      "Boisson",
    ],
  },
  {
    title: "Format du live",
    tags: [
      "Recette rapide",
      "Pas à pas",
      "Débutant friendly",
      "Meal prep",
      "Batch cooking",
      "Challenge",
      "Cuisine économique",
      "Sans four",
      "Air fryer",
      "Fait maison",
    ],
  },
];

/** Number of tags after which a live counts as well described (the gauge reaches 100 %). */
export const TAG_TARGET = 3;

/** Same limit as the backend (PATCH /lives/:id/tags). */
export const MAX_TAGS = 10;
