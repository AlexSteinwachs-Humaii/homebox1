<script setup lang="ts">
  import { computed } from "vue";
  import { decorativeCatAttrs } from "~~/lib/inventory-visuals";

  /**
   * Static decoration for Purrfect Home screens. It is not an item, a pet
   * profile, or an uploaded attachment, and it must not be used as a photo
   * fallback. Hidden from assistive technology unless a real label is passed.
   */
  const props = withDefaults(
    defineProps<{
      decorative?: boolean;
      label?: string;
    }>(),
    {
      decorative: true,
      label: "",
    }
  );

  const attrs = computed(() => decorativeCatAttrs(props.decorative, props.label));
</script>

<template>
  <svg
    viewBox="0 0 180 150"
    xmlns="http://www.w3.org/2000/svg"
    class="block h-auto w-full"
    data-decorative-cat
    v-bind="attrs"
  >
    <circle cx="124" cy="72" r="46" fill="#e6d8f6" />
    <path d="M46 112c-16 6-20 26-6 32 14 6 26-8 22-20" fill="#c9956c" />
    <ellipse cx="96" cy="112" rx="40" ry="26" fill="#e0b184" />
    <ellipse cx="100" cy="118" rx="18" ry="13" fill="#f7eadc" />
    <circle cx="124" cy="74" r="26" fill="#e7b98d" />
    <path d="M104 58l6-20 14 16z" fill="#e7b98d" />
    <path d="M132 50l16-16 4 22z" fill="#e7b98d" />
    <path d="M108 54l4-10 8 8z" fill="#f0c3cb" />
    <path d="M136 46l8-8 2 10z" fill="#f0c3cb" />
    <circle cx="116" cy="74" r="2.6" fill="#3d3350" />
    <circle cx="132" cy="72" r="2.6" fill="#3d3350" />
    <path d="M122 82l3.5 3.2h-7z" fill="#c47b8a" />
    <path d="M158 34l2.2 6.2 6.2 2.2-6.2 2.2-2.2 6.2-2.2-6.2-6.2-2.2 6.2-2.2z" fill="#f0c85a" />
  </svg>
</template>
