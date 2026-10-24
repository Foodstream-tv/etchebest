// Pictograms for kitchen utensils. Matching is done on normalised free text
// (lower case, no accents) because utensils are typed by the streamer:
// "Poêle en fonte", "couteau de chef", "Spatule en bois"…

type UtensilRule = { emoji: string; label: string; keywords: string[] };

const RULES: UtensilRule[] = [
  { emoji: "🔪", label: "Couteau", keywords: ["couteau", "hachoir", "econome", "eplucheur", "mandoline", "ciseaux"] },
  { emoji: "🍳", label: "Poêle", keywords: ["poele", "crepiere", "plancha", "sauteuse"] },
  { emoji: "🥘", label: "Cocotte", keywords: ["cocotte", "marmite", "tajine", "wok", "faitout"] },
  { emoji: "🍲", label: "Casserole", keywords: ["casserole", "poelon", "bain-marie", "bain marie", "autocuiseur"] },
  { emoji: "🥣", label: "Saladier", keywords: ["saladier", "bol", "jatte", "terrine", "cul de poule"] },
  { emoji: "🥄", label: "Cuillère", keywords: ["cuillere", "louche", "spatule", "cuiller", "ecumoire", "maryse"] },
  { emoji: "🥢", label: "Baguettes", keywords: ["baguette", "pince"] },
  { emoji: "🍴", label: "Fourchette", keywords: ["fourchette", "fouet", "batteur"] },
  { emoji: "🪵", label: "Planche", keywords: ["planche", "decouper"] },
  { emoji: "🌀", label: "Mixeur", keywords: ["mixeur", "blender", "robot", "mixer", "hachoir electrique", "presse-puree", "moulinette"] },
  { emoji: "🔥", label: "Four / feu", keywords: ["four", "gril", "grill", "barbecue", "bbq", "feu", "plaque", "induction", "gaz", "chalumeau", "air fryer", "airfryer", "friteuse"] },
  { emoji: "⚖️", label: "Balance", keywords: ["balance", "pese", "verre doseur", "doseur"] },
  { emoji: "⏲️", label: "Minuteur", keywords: ["minuteur", "chrono", "timer"] },
  { emoji: "🌡️", label: "Thermomètre", keywords: ["thermometre", "sonde"] },
  { emoji: "🥫", label: "Passoire", keywords: ["passoire", "chinois", "tamis", "egouttoir", "essoreuse"] },
  { emoji: "🧀", label: "Râpe", keywords: ["rape", "zesteur", "microplane"] },
  { emoji: "🫓", label: "Rouleau", keywords: ["rouleau", "patisserie", "moule", "abaisse", "emporte"] },
  { emoji: "🥛", label: "Verre / mesure", keywords: ["verre", "mesure", "carafe", "shaker"] },
  { emoji: "🫙", label: "Bocal", keywords: ["bocal", "pot", "boite", "bouteille"] },
  { emoji: "🧂", label: "Mortier", keywords: ["mortier", "pilon", "moulin"] },
];

const DEFAULT_EMOJI = "🍽️";

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function getUtensilEmoji(name: string): string {
  const text = normalizeText(name);
  if (!text) return DEFAULT_EMOJI;

  const rule = RULES.find((item) =>
    item.keywords.some((keyword) => text.includes(keyword))
  );

  return rule?.emoji ?? DEFAULT_EMOJI;
}

/**
 * Utensils from the recipe list that are mentioned in a step's text, so the
 * step can show which tool to pick up ("Émincer au couteau" → 🔪 Couteau).
 */
export function findUtensilsInText(
  text: string,
  utensils: readonly string[]
): string[] {
  const haystack = normalizeText(text);
  if (!haystack) return [];

  return utensils.filter((utensil) => {
    const needle = normalizeText(utensil);
    if (!needle) return false;

    // Whole name ("poêle en fonte"), or its first word ("poêle").
    const head = needle.split(/\s+/)[0];
    if (haystack.includes(needle)) return true;
    if (head.length >= 4 && haystack.includes(head)) return true;

    // Same pictogram family: "casserole" in the text, "Petite casserole" listed.
    const rule = RULES.find((item) =>
      item.keywords.some((keyword) => needle.includes(keyword))
    );
    return Boolean(
      rule?.keywords.some(
        (keyword) => keyword.length >= 5 && haystack.includes(keyword)
      )
    );
  });
}

/** Quick-add utensils shown with their pictogram in the live creation form. */
export const UTENSIL_PRESETS = [
  { id: "knife", emoji: "🔪", labelKey: "studio.utensil.knife" },
  { id: "board", emoji: "🪵", labelKey: "studio.utensil.board" },
  { id: "pan", emoji: "🍳", labelKey: "studio.utensil.pan" },
  { id: "pot", emoji: "🍲", labelKey: "studio.utensil.pot" },
  { id: "dutch", emoji: "🥘", labelKey: "studio.utensil.dutch" },
  { id: "wok", emoji: "🥘", labelKey: "studio.utensil.wok" },
  { id: "bowl", emoji: "🥣", labelKey: "studio.utensil.bowl" },
  { id: "whisk", emoji: "🍴", labelKey: "studio.utensil.whisk" },
  { id: "spatula", emoji: "🥄", labelKey: "studio.utensil.spatula" },
  { id: "spoon", emoji: "🥄", labelKey: "studio.utensil.spoon" },
  { id: "blender", emoji: "🌀", labelKey: "studio.utensil.blender" },
  { id: "oven", emoji: "🔥", labelKey: "studio.utensil.oven" },
  { id: "grater", emoji: "🧀", labelKey: "studio.utensil.grater" },
  { id: "scale", emoji: "⚖️", labelKey: "studio.utensil.scale" },
  { id: "colander", emoji: "🥫", labelKey: "studio.utensil.colander" },
  { id: "rollingPin", emoji: "🫓", labelKey: "studio.utensil.rollingPin" },
  { id: "peeler", emoji: "🥕", labelKey: "studio.utensil.peeler" },
] as const;
