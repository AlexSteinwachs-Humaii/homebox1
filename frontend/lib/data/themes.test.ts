import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { darkThemes, isThemeSlug, removableThemeClasses, themes } from "./themes";

const cssPath = fileURLToPath(new URL("../../assets/css/main.css", import.meta.url));
const setThemePath = fileURLToPath(new URL("../../public/set-theme.js", import.meta.url));
const preferencesPath = fileURLToPath(new URL("../../composables/use-preferences.ts", import.meta.url));

function cssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped + "\\s*\\{").exec(css);
  if (!match) {
    throw new Error(`missing CSS block ${selector}`);
  }

  let depth = 1;
  let index = match.index + match[0].length;
  const start = index;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
    }
    index += 1;
  }

  return css.slice(start, index - 1);
}

function channel(value: number) {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = chroma;
    g = x;
  } else if (h < 120) {
    r = x;
    g = chroma;
  } else if (h < 180) {
    g = chroma;
    b = x;
  } else if (h < 240) {
    g = x;
    b = chroma;
  } else if (h < 300) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function contrast(a: [number, number, number], b: [number, number, number]) {
  const luminance = ([red, green, blue]: [number, number, number]) =>
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

function tokens(block: string): Record<string, [number, number, number]> {
  const parsed: Record<string, [number, number, number]> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)%\s+(\d+)%/g)) {
    const name = match[1];
    const hue = match[2];
    const saturation = match[3];
    const lightness = match[4];
    if (!name || hue === undefined || saturation === undefined || lightness === undefined) {
      continue;
    }
    parsed[name] = hslToRgb(Number(hue), Number(saturation), Number(lightness));
  }
  return parsed;
}

describe("Purrfect Home theme registration", () => {
  it("adds an optional theme without replacing Homebox, Light or Dark", () => {
    expect(themes.map(theme => theme.value)).toContain("purrfect-home");
    expect(themes.find(theme => theme.value === "purrfect-home")?.label).toBe("Purrfect Home");
    expect(themes.filter(theme => theme.value === "homebox")).toHaveLength(1);
    expect(themes.filter(theme => theme.value === "light")).toHaveLength(1);
    expect(themes.map(theme => theme.value)).toEqual(expect.arrayContaining(["homebox", "light", "garden", "winter"]));
    expect(darkThemes).not.toContain("purrfect-home");
    expect(darkThemes).toEqual(expect.arrayContaining(["black", "night", "dracula", "coffee"]));
  });

  it("accepts the hyphenated slug and rejects class injection", () => {
    expect(isThemeSlug("purrfect-home")).toBe(true);
    expect(isThemeSlug("homebox")).toBe(true);
    expect(isThemeSlug("light")).toBe(true);
    expect(isThemeSlug("dark")).toBe(true);
    expect(isThemeSlug("purrfect-home;background:red")).toBe(false);
    expect(isThemeSlug("theme home")).toBe(false);
    expect(isThemeSlug("../homebox")).toBe(false);
    expect(isThemeSlug("")).toBe(false);
    expect(isThemeSlug(null)).toBe(false);
  });

  it("clears the new theme class when another theme is applied", () => {
    expect(removableThemeClasses).toContain("theme-purrfect-home");
    expect(removableThemeClasses).toContain("theme-light");
    expect(removableThemeClasses).toContain("dark");
  });
});

describe("Purrfect Home tokens stay scoped and readable", () => {
  const css = readFileSync(cssPath, "utf8");
  const purrfect = cssBlock(css, '.theme-purrfect-home,\n  [data-theme="purrfect-home"]');
  const homebox = cssBlock(css, ":root,.homebox");
  const light = cssBlock(css, ".theme-light");
  const black = cssBlock(css, ".theme-black");
  const colors = tokens(purrfect);

  it("does not change Homebox, Light or a dark theme", () => {
    expect(homebox).toContain("--background: 0 0% 100%;");
    expect(homebox).toContain("--foreground: 0 0% 20%;");
    expect(homebox).toContain("--primary: 139 16% 43%;");
    expect(homebox).toContain("--sidebar-background: 0 0% 90%;");
    expect(homebox).not.toContain("174 65% 22%");
    expect(light).toContain("--background: 0 0% 100%;");
    expect(light).toContain("--primary: 259 94% 51%;");
    expect(black).toContain("--background: 0 0% 0%;");
    expect(black).toContain("--foreground: 0 0% 80%;");
    expect(css.indexOf("174 65% 22%")).toBeGreaterThan(css.indexOf(".theme-purrfect-home"));
    expect(css.slice(0, css.indexOf(".theme-purrfect-home"))).not.toContain("174 65% 22%");
  });

  it("uses cream, plum, lavender and teal only in the new theme", () => {
    expect(purrfect).toContain("--background: 36 56% 96%;");
    expect(purrfect).toContain("--foreground: 264 22% 18%;");
    expect(purrfect).toContain("--sidebar-background: 264 42% 91%;");
    expect(purrfect).toContain("--primary: 174 65% 22%;");
    expect(purrfect).toContain("--accent: 266 46% 91%;");
    expect(colors.background).toBeDefined();
    expect(colors.foreground).toBeDefined();
  });

  it("keeps text, actions, errors, tags and fields above contrast floors", () => {
    const pairs: Array<[string, string, string, number]> = [
      ["plum on cream", "foreground", "background", 4.5],
      ["plum on card", "card-foreground", "card", 4.5],
      ["plum on sidebar", "sidebar-foreground", "sidebar-background", 4.5],
      ["plum on active nav", "sidebar-accent-foreground", "sidebar-accent", 4.5],
      ["plum on tag surface", "accent-foreground", "accent", 4.5],
      ["plum on secondary", "secondary-foreground", "secondary", 4.5],
      ["muted on cream", "muted-foreground", "background", 4.5],
      ["muted on card", "muted-foreground", "card", 4.5],
      ["teal label on teal action", "primary-foreground", "primary", 4.5],
      ["teal link on cream", "primary", "background", 4.5],
      ["teal link on card", "primary", "card", 4.5],
      ["error label on error", "destructive-foreground", "destructive", 4.5],
      ["error text on cream", "destructive", "background", 4.5],
      ["field border on cream", "border", "background", 3],
      ["field border on card", "input", "card", 3],
      ["focus ring on cream", "ring", "background", 3],
      ["focus ring on sidebar", "sidebar-ring", "sidebar-background", 3],
      ["sidebar boundary", "sidebar-border", "sidebar-background", 3],
    ];

    for (const [name, foreground, background, minimum] of pairs) {
      const foregroundColor = colors[foreground];
      const backgroundColor = colors[background];
      expect(foregroundColor, name).toBeDefined();
      expect(backgroundColor, name).toBeDefined();
      if (!foregroundColor || !backgroundColor) {
        continue;
      }
      expect(contrast(foregroundColor, backgroundColor), name).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("scopes disabled, focus and placeholder fixes to the new theme", () => {
    expect(css).toContain("html.theme-purrfect-home :where(button, input, textarea, select");
    expect(css).toContain("opacity: 0.85;");
    expect(css).toContain('html[data-theme="purrfect-home"] :where(input, textarea)::placeholder');
    expect(css).not.toMatch(/^button:disabled/m);
  });
});

describe("early theme application", () => {
  const script = readFileSync(setThemePath, "utf8");

  function apply(stored: unknown, existing: string[] = []) {
    const classes = new Set(existing);
    const attrs: Record<string, string> = {};
    const logs: unknown[][] = [];
    const errors: unknown[][] = [];
    const classList = {
      add(value: string) {
        classes.add(value);
      },
      remove(value: string) {
        classes.delete(value);
      },
      [Symbol.iterator]() {
        return classes[Symbol.iterator]();
      },
    };
    runInNewContext(script, {
      console: {
        log: (...args: unknown[]) => logs.push(args),
        error: (...args: unknown[]) => errors.push(args),
      },
      localStorage: {
        getItem: () => (stored === undefined ? null : JSON.stringify(stored)),
      },
      document: {
        documentElement: {
          setAttribute(name: string, value: string) {
            attrs[name] = value;
          },
          classList,
        },
      },
    });
    return { attrs, classes: [...classes], errors };
  }

  it("applies purrfect-home before the app mounts and drops the previous theme class", () => {
    const applied = apply({ theme: "purrfect-home" }, ["theme-light", "theme-homebox"]);
    expect(applied.attrs["data-theme"]).toBe("purrfect-home");
    expect(applied.classes).toEqual(["theme-purrfect-home"]);
    expect(applied.errors).toEqual([]);
  });

  it("leaves Homebox in place for a missing or unsafe stored theme", () => {
    expect(apply(undefined, ["theme-light"]).classes).toEqual(["theme-light"]);
    expect(apply({ theme: "purrfect-home x" }, ["theme-light"]).classes).toEqual(["theme-light"]);
    expect(apply({ theme: "" }).attrs["data-theme"]).toBeUndefined();
  });

  it("reads the same preference key the app syncs, and theme stays a synced preference", () => {
    const preferences = readFileSync(preferencesPath, "utf8");
    expect(script).toContain("homebox/preferences/location");
    expect(preferences).toContain('useLocalStorage("homebox/preferences/location"');
    expect(preferences).toContain('theme: "homebox"');
    expect(preferences).not.toMatch(/theme:\s*false/);
  });
});
