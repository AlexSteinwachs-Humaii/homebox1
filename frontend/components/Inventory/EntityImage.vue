<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import {
    INVENTORY_IMAGE_FALLBACK,
    resolveInventoryImage,
    type InventoryImagePreference,
  } from "~~/lib/inventory-visuals";

  const props = withDefaults(
    defineProps<{
      entityId: string;
      name?: string | null;
      imageId?: string | null;
      thumbnailId?: string | null;
      attachmentId?: string | null;
      attachmentThumbnailId?: string | null;
      prefer?: InventoryImagePreference;
      fit?: "contain" | "cover";
    }>(),
    {
      name: "",
      imageId: null,
      thumbnailId: null,
      attachmentId: null,
      attachmentThumbnailId: null,
      prefer: "thumbnail",
      fit: "contain",
    }
  );

  const api = useUserApi();
  const failed = ref(false);

  const resolved = computed(() =>
    resolveInventoryImage(
      {
        entityId: props.entityId,
        imageId: props.imageId,
        thumbnailId: props.thumbnailId,
        attachmentId: props.attachmentId,
        attachmentThumbnailId: props.attachmentThumbnailId,
        prefer: props.prefer,
      },
      url => api.authURL(url)
    )
  );

  watch(resolved, () => {
    failed.value = false;
  });

  const showPhoto = computed(() => resolved.value !== null && !failed.value);

  const labelName = computed(() => props.name?.trim() || "");

  function onError() {
    failed.value = true;
  }
</script>

<template>
  <div
    class="relative overflow-hidden bg-accent text-accent-foreground"
    data-inventory-image
    :data-image-kind="showPhoto ? resolved?.kind : INVENTORY_IMAGE_FALLBACK"
  >
    <img
      v-if="showPhoto && fit === 'contain'"
      class="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-md"
      alt=""
      aria-hidden="true"
      :src="resolved?.url"
    />
    <img
      v-if="showPhoto"
      class="relative size-full"
      :class="fit === 'cover' ? 'object-cover' : 'object-contain'"
      loading="lazy"
      :src="resolved?.url"
      :alt="labelName || $t('purrfect.no_photo_unnamed')"
      @error="onError"
    />
    <div
      v-else
      class="flex size-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground"
      role="img"
      :aria-label="labelName ? $t('purrfect.no_photo', { name: labelName }) : $t('purrfect.no_photo_unnamed')"
      data-image-fallback
    >
      <svg viewBox="0 0 48 48" class="size-10" aria-hidden="true" focusable="false">
        <rect x="6" y="10" width="36" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="2.5" />
        <path d="M8 34l10-10 6 6 4-4 12 10" fill="none" stroke="currentColor" stroke-width="2.5" />
        <path d="M10 8l28 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <span class="text-sm font-medium">{{ $t("purrfect.no_photo_label") }}</span>
    </div>
  </div>
</template>
