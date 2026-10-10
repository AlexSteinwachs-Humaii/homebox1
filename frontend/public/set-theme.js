try {
  console.log("Setting theme");
  const stored = localStorage.getItem("homebox/preferences/location");
  if (stored) {
    const theme = JSON.parse(stored).theme;
    // Keep in step with isThemeSlug in lib/data/themes.ts. purrfect-home is a valid slug.
    if (typeof theme === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(theme)) {
      const root = document.documentElement;
      root.setAttribute("data-theme", theme);
      Array.from(root.classList)
        .filter(className => className.startsWith("theme-"))
        .forEach(className => root.classList.remove(className));
      root.classList.add("theme-" + theme);
    }
  }
} catch (e) {
  console.error("Failed to set theme", e);
}
