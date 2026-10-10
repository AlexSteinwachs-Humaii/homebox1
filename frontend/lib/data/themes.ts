export type DaisyTheme =
  | "homebox"
  | "purrfect-home"
  | "light"
  | "dark"
  | "cupcake"
  | "bumblebee"
  | "emerald"
  | "corporate"
  | "synthwave"
  | "retro"
  | "cyberpunk"
  | "valentine"
  | "halloween"
  | "garden"
  | "forest"
  | "aqua"
  | "lofi"
  | "pastel"
  | "fantasy"
  | "wireframe"
  | "black"
  | "luxury"
  | "dracula"
  | "cmyk"
  | "autumn"
  | "business"
  | "acid"
  | "lemonade"
  | "night"
  | "coffee"
  | "winter";

export type ThemeOption = {
  label: string;
  value: DaisyTheme;
};

export const themes: ThemeOption[] = [
  {
    label: "Homebox",
    value: "homebox",
  },
  {
    label: "Purrfect Home",
    value: "purrfect-home",
  },
  {
    label: "Garden",
    value: "garden",
  },
  {
    label: "Light",
    value: "light",
  },
  {
    label: "Cupcake",
    value: "cupcake",
  },
  {
    label: "Bumblebee",
    value: "bumblebee",
  },
  {
    label: "Emerald",
    value: "emerald",
  },
  {
    label: "Corporate",
    value: "corporate",
  },
  {
    label: "Synthwave",
    value: "synthwave",
  },
  {
    label: "Retro",
    value: "retro",
  },
  {
    label: "Cyberpunk",
    value: "cyberpunk",
  },
  {
    label: "Valentine",
    value: "valentine",
  },
  {
    label: "Halloween",
    value: "halloween",
  },
  {
    label: "Forest",
    value: "forest",
  },
  {
    label: "Aqua",
    value: "aqua",
  },
  {
    label: "Lofi",
    value: "lofi",
  },
  {
    label: "Pastel",
    value: "pastel",
  },
  {
    label: "Fantasy",
    value: "fantasy",
  },
  {
    label: "Wireframe",
    value: "wireframe",
  },
  {
    label: "Black",
    value: "black",
  },
  {
    label: "Luxury",
    value: "luxury",
  },
  {
    label: "Dracula",
    value: "dracula",
  },
  {
    label: "Cmyk",
    value: "cmyk",
  },
  {
    label: "Autumn",
    value: "autumn",
  },
  {
    label: "Business",
    value: "business",
  },
  {
    label: "Acid",
    value: "acid",
  },
  {
    label: "Lemonade",
    value: "lemonade",
  },
  {
    label: "Night",
    value: "night",
  },
  {
    label: "Coffee",
    value: "coffee",
  },
  {
    label: "Winter",
    value: "winter",
  },
];

/** Class-safe theme token. Hyphenated slugs such as purrfect-home are valid. */
const THEME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isThemeSlug(value: unknown): value is string {
  return typeof value === "string" && THEME_SLUG.test(value);
}

/**
 * Classes cleared from <html> before a theme is applied.
 * `dark` is the legacy color-mode class, not a Daisy theme slug.
 */
export const removableThemeClasses = [
  "dark",
  "theme-aqua",
  "theme-black",
  "theme-bumblebee",
  "theme-cmyk",
  "theme-corporate",
  "theme-cupcake",
  "theme-cyberpunk",
  "theme-dracula",
  "theme-emerald",
  "theme-fantasy",
  "theme-forest",
  "theme-garden",
  "theme-halloween",
  "theme-light",
  "theme-lofi",
  "theme-luxury",
  "theme-pastel",
  "theme-purrfect-home",
  "theme-retro",
  "theme-synthwave",
  "theme-valentine",
  "theme-wireframe",
  "theme-autumn",
  "theme-business",
  "theme-acid",
  "theme-lemonade",
  "theme-night",
  "theme-coffee",
  "theme-winter",
];

export const darkThemes: DaisyTheme[] = [
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "forest",
  "aqua",
  "black",
  "luxury",
  "dracula",
  "business",
  "night",
  "coffee",
];
