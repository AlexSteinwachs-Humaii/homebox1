<script setup lang="ts">
  import { nextTick } from "vue";
  import { themes } from "~~/lib/data/themes";
  import { useTheme } from "~/composables/use-theme";

  const { setTheme, theme: activeTheme } = useTheme();

  function isTabStop(value: string) {
    const known = themes.some(option => option.value === activeTheme.value);
    const stop = known ? activeTheme.value : themes[0]?.value;
    return value === stop;
  }

  function activate(value: (typeof themes)[number]["value"]) {
    setTheme(value);
  }

  function focusOption(element: HTMLElement) {
    const focus = element.focus.bind(element) as (options?: { focusVisible?: boolean }) => void;
    focus({ focusVisible: true });
  }

  function onKeydown(event: KeyboardEvent, index: number) {
    const currentOption = themes[index];
    if (!currentOption) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(currentOption.value);
      return;
    }

    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) {
      return;
    }

    event.preventDefault();
    const nextOption = themes[(index + delta + themes.length) % themes.length];
    if (!nextOption) {
      return;
    }

    activate(nextOption.value);
    const current = event.currentTarget as HTMLElement | null;
    const group = current?.closest("[role='radiogroup']");
    void nextTick(() => {
      const next = group?.querySelector<HTMLElement>(`[data-set-theme="${nextOption.value}"]`);
      if (next) {
        focusOption(next);
      }
    });
  }
</script>

<template>
  <div
    class="homebox grid grid-cols-1 gap-4 font-sans sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    role="radiogroup"
    :aria-label="$t('profile.theme_settings')"
  >
    <div
      v-for="(theme, index) in themes"
      :key="theme.value"
      role="radio"
      class="relative overflow-hidden rounded-lg border"
      data-theme-option
      :class="'theme-' + theme.value"
      :data-theme="theme.value"
      :data-set-theme="theme.value"
      :aria-label="theme.label"
      :aria-checked="activeTheme === theme.value"
      :tabindex="isTabStop(theme.value) ? 0 : -1"
      @click="activate(theme.value)"
      @keydown="onKeydown($event, index)"
    >
      <span v-if="activeTheme === theme.value" data-selected-mark aria-hidden="true">
        <svg viewBox="0 0 16 16" class="size-3" focusable="false">
          <path
            d="M3.2 8.4 6.3 11.6 12.8 4.4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <div :data-theme="theme.value" class="w-full cursor-pointer bg-background-accent text-foreground">
        <div class="grid grid-cols-5 grid-rows-3">
          <div class="col-start-1 row-start-1 bg-background" />
          <div class="col-start-1 row-start-2 bg-sidebar" />
          <div class="col-start-1 row-start-3 bg-background-accent" />
          <div class="col-span-4 col-start-2 row-span-3 row-start-1 flex flex-col gap-1 bg-background p-2">
            <div class="font-bold">{{ theme.label }}</div>
            <div class="flex flex-wrap gap-1">
              <div class="flex size-5 items-center justify-center rounded bg-primary lg:size-6">
                <div class="text-sm font-bold text-primary-foreground">A</div>
              </div>
              <div class="flex size-5 items-center justify-center rounded bg-secondary lg:size-6">
                <div class="text-sm font-bold text-secondary-foreground">A</div>
              </div>
              <div class="flex size-5 items-center justify-center rounded bg-accent lg:size-6">
                <div class="text-sm font-bold text-accent-foreground">A</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  [data-theme-option]:focus-visible,
  [data-theme-option][aria-checked="true"] {
    outline: 2px solid #1c1528;
    outline-offset: 2px;
    box-shadow: 0 0 0 2px #ffffff;
  }

  [data-theme-option][aria-checked="true"]:focus-visible {
    outline-offset: 4px;
    box-shadow:
      0 0 0 4px #ffffff,
      0 0 0 6px #1c1528;
  }

  [data-selected-mark] {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    z-index: 1;
    display: flex;
    width: 1.25rem;
    height: 1.25rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #145d55;
    color: #fbf6ef;
    box-shadow: 0 0 0 2px #fbf6ef;
  }
</style>
