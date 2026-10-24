import { ChefHat, Globe, Salad } from "lucide-react";

/** Tag categories offered by the live filters (home hero and lives catalogue). */
export const TAG_GROUPS = [
  {
    key: "cuisine",
    titleKey: "home.hero.group.cuisine" as const,
    defaultTitle: "Cuisine",
    icon: Globe,
    tags: [
      "Asiatique",
      "Africain",
      "Européen",
      "Américain",
      "Français",
      "Italien",
      "Mexicain",
      "Japonais",
      "Coréen",
      "Chinois",
      "Indien",
    ],
  },
  {
    key: "dishType",
    titleKey: "home.hero.group.dishType" as const,
    defaultTitle: "Type de plat",
    icon: Salad,
    tags: [
      "Végétarien",
      "Vegan",
      "Pâtisserie",
      "Dessert",
      "Street Food",
      "BBQ",
      "Healthy",
      "Apéro",
      "Petit-déjeuner",
      "Boisson",
    ],
  },
  {
    key: "format",
    titleKey: "home.hero.group.format" as const,
    defaultTitle: "Format",
    icon: ChefHat,
    tags: [
      "Recette rapide",
      "Pas à pas",
      "Débutant friendly",
      "Meal prep",
      "Cuisine économique",
      "Challenge",
      "Fait maison",
    ],
  },
];
