export const ORANGE_GRADIENT = ["#FF8A2E", "#FF7A1A"] as const;

/**
 * Brand gradient. Driven by CSS variables so it follows the accessibility
 * palette (see `app/accessibility.css`); defaults to the original orange.
 */
export const ORANGE_GRADIENT_CSS =
  "linear-gradient(90deg, var(--fs-grad-from, #FF8A2E) 0%, var(--fs-grad-to, #FF7A1A) 100%)";
