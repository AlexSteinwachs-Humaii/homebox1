<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { statCardData, type StatKey } from "./statistics";
  import { itemsTable } from "./table";
  import { featuredBelongings } from "./overview";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import { inventoryLocationPresentation } from "~~/lib/inventory-visuals";
  import type { EntitySummary } from "~~/lib/api/types/data-contracts";
  import BaseContainer from "@/components/Base/Container.vue";
  import BaseCard from "@/components/Base/Card.vue";
  import Subtitle from "~/components/global/Subtitle.vue";
  import StatCard from "~/components/global/StatCard/StatCard.vue";
  import ItemCard from "~/components/Item/Card.vue";
  import LocationCard from "~/components/Location/Card.vue";
  import TagChip from "~/components/Tag/Chip.vue";
  import Table from "~/components/Item/View/Table.vue";
  import DecorativeCat from "~/components/Inventory/DecorativeCat.vue";
  import Currency from "@/components/global/Currency.vue";

  const { t } = useI18n();

  definePageMeta({
    middleware: ["auth"],
  });
  useHead({
    title: "HomeBox | " + t("menu.home"),
  });

  const api = useUserApi();
  const breakpoints = useBreakpoints();
  const { theme } = useTheme();
  const { selectedCollection } = useCollections();

  const purrfect = computed(() => theme.value === "purrfect-home");
  const collectionName = computed(() => selectedCollection.value?.name?.trim() || "");

  const locationStore = useLocationStore();
  const locations = computed(() => locationStore.parentLocations);
  const locationFlatTree = useFlatLocations();

  const tagsStore = useTagStore();
  const tags = computed(() => tagsStore.tags);

  const itemTable = itemsTable(api);
  const stats = statCardData(api);

  const recentItems = computed(() => itemTable.value.items);
  const featuredItems = computed(() => featuredBelongings(recentItems.value));

  const overviewStatOrder: StatKey[] = ["items", "locations", "tags", "value"];
  const overviewStats = computed(() => {
    const labels: Record<StatKey, string> = {
      items: t("purrfect.stat_items"),
      locations: t("purrfect.stat_locations"),
      tags: t("purrfect.stat_tags"),
      value: t("purrfect.stat_value"),
    };
    const byKey = new Map(stats.value.map(stat => [stat.key, stat]));
    return overviewStatOrder.flatMap(key => {
      const stat = byKey.get(key);
      if (!stat) {
        return [];
      }
      return [{ ...stat, label: labels[key] }];
    });
  });
  const locationTotal = computed(() => stats.value.find(stat => stat.key === "locations")?.value ?? 0);

  function placeFor(item: EntitySummary): string | null {
    const presentation = inventoryLocationPresentation({
      treeString: locationFlatTree.value.find(entry => entry.id === item.parent?.id)?.treeString,
      parent: item.parent,
    });
    const leaf = presentation.segments.at(-1)?.trim();
    return leaf || null;
  }
</script>

<template>
  <div>
    <BaseContainer v-if="purrfect" class="pb-8">
      <div data-overview="purrfect" class="flex flex-col gap-8">
        <section
          data-testid="purrfect-hero"
          class="relative overflow-hidden rounded-3xl bg-accent p-8 text-accent-foreground"
        >
          <div class="relative z-10 max-w-xl">
            <p
              class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
              data-testid="overview-kicker"
            >
              <template v-if="collectionName">
                {{ collectionName }}
                <span aria-hidden="true"> / </span>
              </template>
              {{ $t("purrfect.overview") }}
            </p>
            <h1 class="mt-3 text-4xl font-semibold leading-tight tracking-tight">
              {{ $t("purrfect.hero_title_line_1") }}
              <span class="block">{{ $t("purrfect.hero_title_line_2") }}</span>
            </h1>
            <p class="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {{ $t("purrfect.hero_body") }}
            </p>
          </div>
          <div class="pointer-events-none absolute bottom-2 right-6 hidden w-44 sm:block" data-testid="hero-cat">
            <DecorativeCat />
          </div>
        </section>

        <section data-testid="explore-spaces">
          <div class="mb-4 flex items-end justify-between gap-4">
            <h2 class="text-xl font-semibold leading-snug">{{ $t("purrfect.explore_spaces") }}</h2>
            <NuxtLink
              to="/locations"
              data-testid="browse-locations"
              class="shrink-0 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {{
                locationTotal > 0
                  ? $t("purrfect.all_locations_count", { count: locationTotal })
                  : $t("purrfect.all_locations")
              }}
              <span aria-hidden="true"> →</span>
            </NuxtLink>
          </div>
          <p v-if="locations.length === 0" class="text-sm text-muted-foreground">{{ $t("locations.no_results") }}</p>
          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <LocationCard v-for="location in locations" :key="location.id" :location="location" />
          </div>
        </section>

        <section data-testid="featured-belongings">
          <div class="mb-4 flex items-end justify-between gap-4">
            <h2 class="text-xl font-semibold leading-snug">{{ $t("purrfect.a_few_belongings") }}</h2>
            <NuxtLink
              to="/items"
              data-testid="browse-items"
              class="shrink-0 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {{ $t("purrfect.browse_all_items") }}
              <span aria-hidden="true"> →</span>
            </NuxtLink>
          </div>
          <p v-if="featuredItems.length === 0" class="text-sm text-muted-foreground">{{ $t("items.no_results") }}</p>
          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ItemCard
              v-for="item in featuredItems"
              :key="item.id"
              :item="item"
              :location-flat-tree="locationFlatTree"
            />
          </div>
        </section>

        <section data-testid="recent-strip" class="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          <h2 class="text-sm font-semibold">{{ $t("purrfect.recently_added") }}</h2>
          <p v-if="recentItems.length === 0" class="text-sm text-muted-foreground">{{ $t("items.no_results") }}</p>
          <NuxtLink
            v-for="item in recentItems"
            :key="item.id"
            :to="`/item/${item.id}`"
            data-testid="recent-item"
            class="rounded-full border border-border bg-card px-3 py-1 text-sm text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span class="break-words">{{ item.name }}</span>
            <template v-if="placeFor(item)">
              <span class="sr-only">, </span>
              <span aria-hidden="true"> · </span>
              <span class="break-words">{{ placeFor(item) }}</span>
            </template>
          </NuxtLink>
        </section>

        <section
          data-testid="purrfect-stats"
          class="flex flex-wrap items-end justify-between gap-6 border-t border-border/60 pt-6"
        >
          <dl class="flex flex-wrap gap-x-10 gap-y-4">
            <div v-for="stat in overviewStats" :key="stat.key" :data-stat="stat.key">
              <dd class="text-3xl font-semibold leading-none tracking-tight">
                <Currency v-if="stat.type === 'currency'" :amount="stat.value" />
                <template v-else>{{ stat.value }}</template>
              </dd>
              <dt class="mt-1 text-xs text-muted-foreground">{{ stat.label }}</dt>
            </div>
          </dl>
          <p class="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground" data-testid="purrfect-theme-label">
            {{ $t("purrfect.optional_theme") }}
          </p>
        </section>
      </div>
    </BaseContainer>

    <BaseContainer v-else class="flex flex-col gap-4">
      <div data-overview="classic" class="flex flex-col gap-4">
        <section>
          <Subtitle> {{ $t("home.quick_statistics") }} </Subtitle>
          <div class="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-6">
            <StatCard v-for="(stat, i) in stats" :key="i" :title="stat.label" :value="stat.value" :type="stat.type" />
          </div>
        </section>

        <section>
          <Subtitle> {{ $t("home.recently_added") }} </Subtitle>

          <p v-if="itemTable.items.length === 0" class="ml-2 text-sm">{{ $t("items.no_results") }}</p>
          <BaseCard v-else-if="breakpoints.lg">
            <Table :items="itemTable.items" />
          </BaseCard>
          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ItemCard v-for="item in itemTable.items" :key="item.id" :item="item" />
          </div>
        </section>

        <section>
          <Subtitle> {{ $t("home.storage_locations") }} </Subtitle>
          <p v-if="locations.length === 0" class="ml-2 text-sm">{{ $t("locations.no_results") }}</p>
          <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <LocationCard v-for="location in locations" :key="location.id" :location="location" />
          </div>
        </section>

        <section>
          <Subtitle> {{ $t("home.tags") }} </Subtitle>
          <p v-if="tags.length === 0" class="ml-2 text-sm">{{ $t("tags.no_results") }}</p>
          <div v-else class="flex flex-wrap gap-4">
            <TagChip v-for="tag in tags" :key="tag.id" size="lg" :tag="tag" class="shadow-md" />
          </div>
        </section>
      </div>
    </BaseContainer>
  </div>
</template>
