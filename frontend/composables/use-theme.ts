import type { ComputedRef } from "vue";
import { isThemeSlug, removableThemeClasses, type DaisyTheme } from "~~/lib/data/themes";

export interface UseTheme {
  theme: ComputedRef<DaisyTheme>;
  setTheme: (theme: DaisyTheme) => void;
}

export function useTheme(): UseTheme {
  const preferences = useViewPreferences();
  const theme = computed(() => preferences.value.theme);
  const htmlEl = ref<HTMLElement | null>(null);

  const applyThemeToDom = (newTheme: DaisyTheme) => {
    if (!htmlEl.value) {
      return;
    }

    // Unsafe stored values fall back to Homebox. Hyphenated slugs such as purrfect-home still apply.
    const slug = isThemeSlug(newTheme) ? newTheme : "homebox";

    htmlEl.value.setAttribute("data-theme", slug);

    const prefixedThemeClasses = Array.from(htmlEl.value.classList).filter(className => className.startsWith("theme-"));
    if (prefixedThemeClasses.length > 0) {
      htmlEl.value.classList.remove(...prefixedThemeClasses);
    }

    htmlEl.value.classList.remove(...removableThemeClasses);
    htmlEl.value.classList.add("theme-" + slug);
  };

  const setTheme = (newTheme: DaisyTheme) => {
    preferences.value.theme = newTheme;
  };

  onMounted(() => {
    htmlEl.value = document.querySelector("html");
    applyThemeToDom(theme.value);
  });

  watch(theme, newTheme => {
    applyThemeToDom(newTheme);
  });

  return { theme, setTheme };
}

export function useIsThemeInList(list: DaisyTheme[]) {
  const theme = useTheme();

  return computed(() => {
    return list.includes(theme.theme.value);
  });
}
