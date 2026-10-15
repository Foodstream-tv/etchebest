export type Ingredient = { name: string; qty: string };

export const DEFAULT_QUANTITY = "Au goût";

/**
 * Units recognised after the amount. Compound and abbreviated spoons come first and each unit must be
 * followed by a space or the end: "kg" is not read as "g", "gousses" not as "g", and
 * "2 cuillères à soupe de miel" keeps "à soupe" in the quantity. Keep in sync with
 * mobile/utils/studioRecipe.ts.
 */
const UNITS = [
  "cuill[eè]res?\\s+à\\s+(?:soupe|café)",
  "c\\.?\\s?à\\s+(?:soupe|café)",
  "c\\.?\\s?à\\.?\\s?[sc]\\.?",
  "cuill[eè]res?",
  "sachets?",
  "pinc[ée]es?",
  "gousses?",
  "bottes?",
  "brins?",
  "tasses?",
  "poign[ée]es?",
  "tranches?",
  "verres?",
  "pots?",
  "litres?",
  "grammes?",
  "kilos?",
  "kg",
  "mg",
  "ml",
  "cl",
  "dl",
  "g",
  "l",
];

const INGREDIENT_PATTERN = new RegExp(
  `^([\\d/\\s.,¼½¾-]+(?:(?:${UNITS.join("|")})(?=\\s|$))?)(?:\\s+(?:de\\s+|d'))?\\s*(.*)$`,
  "i"
);

/** Splits "200 g de farine" into { qty: "200 g", name: "farine" }; "Au goût" when there is no amount. */
export function parseIngredient(raw: string): Ingredient {
  const text = raw.trim();
  const match = INGREDIENT_PATTERN.exec(text);
  if (match && match[2].trim()) {
    return { name: match[2].trim(), qty: match[1].trim() };
  }
  return { name: text, qty: DEFAULT_QUANTITY };
}
