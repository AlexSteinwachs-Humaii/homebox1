<template>
  <Card
    data-inventory-card="location"
    :data-count-state="count === null ? 'unknown' : 'known'"
    :data-count="count === null ? undefined : String(count)"
    :class="
      purrfect ? 'overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm' : undefined
    "
  >
    <NuxtLink
      v-if="purrfect"
      :to="`/location/${location.id}`"
      class="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      :class="dense ? 'px-3 py-2' : 'p-4'"
      data-testid="location-link"
    >
      <span
        class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
        aria-hidden="true"
      >
        <MdiHomeOutline class="size-6" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block break-words text-base font-semibold leading-snug">{{ location.name }}</span>
        <template v-if="count !== null">
          <span class="sr-only">, </span>
          <span class="mt-0.5 block text-sm text-muted-foreground" data-testid="location-count">
            {{ $t("purrfect.location_items", { count }) }}
          </span>
        </template>
      </span>
      <MdiArrowRight class="size-5 shrink-0 text-primary" aria-hidden="true" />
    </NuxtLink>
    <NuxtLink
      v-else
      :to="`/location/${location.id}`"
      class="group/location-card transition duration-300"
      data-testid="location-link"
    >
      <div
        :class="{
          'p-4': !dense,
          'px-3 py-2': dense,
        }"
      >
        <h2 class="flex items-center justify-between gap-2">
          <div class="relative size-6">
            <div
              class="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover/location-card:-rotate-90"
            >
              <MdiMapMarkerOutline class="size-6 group-hover/location-card:hidden" />
              <MdiArrowUp class="hidden size-6 group-hover/location-card:block" />
            </div>
          </div>
          <span class="mx-auto">
            {{ location.name }}
          </span>
          <Badge v-if="count !== null" data-testid="location-count">
            {{ count }}
          </Badge>
        </h2>
      </div>
    </NuxtLink>
  </Card>
</template>

<script lang="ts" setup>
  import type { EntityOut, EntitySummary } from "~~/lib/api/types/data-contracts";
  import MdiArrowUp from "~icons/mdi/arrow-down";
  import MdiArrowRight from "~icons/mdi/arrow-right";
  import MdiHomeOutline from "~icons/mdi/home-outline";
  import MdiMapMarkerOutline from "~icons/mdi/map-marker-outline";
  import { Card } from "@/components/ui/card";
  import { Badge } from "@/components/ui/badge";
  import { knownCount } from "~~/lib/inventory-visuals";

  const props = defineProps({
    location: {
      type: Object as () => EntitySummary | EntityOut,
      required: true,
    },
    dense: {
      type: Boolean,
      default: false,
    },
  });

  const { theme } = useTheme();
  const purrfect = computed(() => theme.value === "purrfect-home");

  const count = computed(() => knownCount((props.location as { itemCount?: unknown }).itemCount));
</script>
