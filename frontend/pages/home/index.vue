<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { statCardData, type StatKey } from "./statistics";
  import { itemsTable } from "./table";
  import { featuredBelongings } from "./overview";
  import { formatStatNumber, viewState } from "./overview-state";
  import { activeCollectionId } from "~~/composables/use-collections";
  import { getLocaleCode } from "~~/composables/use-formatters";
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

  const breakpoints = useBreakpoints();
  const { theme } = useTheme();
  const { selectedId, selectedCollection } = useCollections();
  const preferences = useViewPreferences();

  const purrfect = computed(() => theme.value === "purrfect-home");
  const collectionName = computed(() => selectedCollection.value?.name?.trim() || "");
  const collectionId = computed(() => selectedId.value ?? preferences.value.collectionId ?? null);
  const statLocale = computed(() => getLocaleCode());

  const locationStore = useLocationStore();
  const locationsState = computed(() => viewState(locationStore.parentsStatus));
  const locations = computed(() => (locationsState.value === "ready" ? (locationStore.parents ?? []) : []));
  const locationFlatTree = useFlatLocations();

  const tagsStore = useTagStore();
  const tagsState = computed(() => viewState(tagsStore.tagsStatus));
  const tags = computed(() => (tagsState.value === "ready" ? tagsStore.tags : []));

  const { items: recentItems, status: itemsStatus, refresh: retryItems } = itemsTable();
  const { cards: statCards, status: statsStatus, refresh: retryStats } = statCardData();
  const featuredItems = computed(() => featuredBelongings(recentItems.value));

  const overviewStatOrder: StatKey[] = ["items", "locations", "tags", "value"];
  const overviewStats = computed(() => {
    const labels: Record<StatKey, string> = {
      items: t("purrfect.stat_items"),
      locations: t("purrfect.stat_locations"),
      tags: t("purrfect.stat_tags"),
      value: t("purrfect.stat_value"),
    };
    const byKey = new Map(statCards.value.map(stat => [stat.key, stat]));
    return overviewStatOrder.flatMap(key => {
      const stat = byKey.get(key);
      if (!stat) {
        return [];
      }
      return [{ ...stat, label: labels[key] }];
    });
  });
  const locationTotal = computed(() => {
    if (statsStatus.value !== "ready") {
      return null;
    }
    return statCards.value.find(stat => stat.key === "locations")?.value ?? null;
  });

  function syncCollectionRecords(id: string | null) {
    locationStore.prepareForCollection(id);
    tagsStore.prepareForCollection(id);
    void locationStore.refreshParents();
    void locationStore.refreshTree();
    void tagsStore.refresh();
  }

  watch(
    collectionId,
    id => {
      syncCollectionRecords(id);
    },
    { flush: "sync" }
  );

  onMounted(() => {
    // Layout also fetches these. If that fetch was for another collection, drop it.
    if (locationStore.boundCollectionId !== collectionId.value || locationStore.parentsStatus === "idle") {
      syncCollectionRecords(collectionId.value ?? activeCollectionId());
    }
  });

  function retryLocations() {
    void locationStore.refreshParents();
  }

  function retryTags() {
    void tagsStore.refresh();
  }

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
                locationTotal !== null && locationTotal > 0
                  ? $t("purrfect.all_locations_count", { count: locationTotal })
                  : $t("purrfect.all_locations")
              }}
              <span aria-hidden="true"> →</span>
            </NuxtLink>
          </div>
          <p v-if="locationsState === 'pending'" role="status" data-testid="locations-state" data-state="pending">
            {{ $t("home.locations_loading") }}
          </p>
          <div
            v-else-if="locationsState === 'error'"
            role="alert"
            data-testid="locations-state"
            data-state="error"
            class="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.locations_failed") }}</p>
            <button
              type="button"
              data-testid="locations-retry"
              class="rounded-md border border-border bg-card px-3 py-1 font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              @click="retryLocations"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <p
            v-else-if="locations.length === 0"
            data-testid="locations-state"
            data-state="empty"
            class="text-sm text-muted-foreground"
          >
            {{ $t("locations.no_results") }}
          </p>
          <div v-else data-testid="locations-state" data-state="ready" class="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <p
            v-if="itemsStatus === 'pending'"
            role="status"
            data-testid="items-state"
            data-state="pending"
            class="text-sm text-muted-foreground"
          >
            {{ $t("home.items_loading") }}
          </p>
          <div
            v-else-if="itemsStatus === 'error'"
            role="alert"
            data-testid="items-state"
            data-state="error"
            class="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.items_failed") }}</p>
            <button
              type="button"
              data-testid="items-retry"
              class="rounded-md border border-border bg-card px-3 py-1 font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              @click="retryItems"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <p
            v-else-if="featuredItems.length === 0"
            data-testid="items-state"
            data-state="empty"
            class="text-sm text-muted-foreground"
          >
            {{ $t("items.no_results") }}
          </p>
          <div v-else data-testid="items-state" data-state="ready" class="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <p v-if="itemsStatus === 'pending'" role="status" class="text-sm text-muted-foreground">
            {{ $t("home.items_loading") }}
          </p>
          <p v-else-if="itemsStatus === 'error'" class="text-sm text-muted-foreground">{{ $t("home.items_failed") }}</p>
          <p v-else-if="recentItems.length === 0" class="text-sm text-muted-foreground">{{ $t("items.no_results") }}</p>
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
          :data-state="statsStatus"
          class="flex flex-wrap items-end justify-between gap-6 border-t border-border/60 pt-6"
        >
          <p
            v-if="statsStatus === 'pending'"
            role="status"
            data-testid="stats-state"
            data-state="pending"
            class="text-sm text-muted-foreground"
          >
            {{ $t("home.stats_loading") }}
          </p>
          <div
            v-else-if="statsStatus === 'error'"
            role="alert"
            data-testid="stats-state"
            data-state="error"
            class="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.stats_failed") }}</p>
            <button
              type="button"
              data-testid="stats-retry"
              class="rounded-md border border-border bg-card px-3 py-1 font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              @click="retryStats"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <dl v-else data-testid="stats-state" data-state="ready" class="flex flex-wrap gap-x-10 gap-y-4">
            <div v-for="stat in overviewStats" :key="stat.key" :data-stat="stat.key">
              <dd class="text-3xl font-semibold leading-none tracking-tight">
                <Currency v-if="stat.type === 'currency'" :amount="stat.value" />
                <template v-else>{{ formatStatNumber(stat.value, statLocale) }}</template>
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
          <p
            v-if="statsStatus === 'pending'"
            role="status"
            data-testid="stats-state"
            data-state="pending"
            class="ml-2 text-sm"
          >
            {{ $t("home.stats_loading") }}
          </p>
          <div
            v-else-if="statsStatus === 'error'"
            role="alert"
            data-testid="stats-state"
            data-state="error"
            class="ml-2 flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.stats_failed") }}</p>
            <button
              type="button"
              data-testid="stats-retry"
              class="font-medium text-primary underline"
              @click="retryStats"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <div
            v-else
            data-testid="stats-state"
            data-state="ready"
            class="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-6"
          >
            <StatCard
              v-for="stat in statCards"
              :key="stat.key"
              :title="stat.label"
              :value="stat.value"
              :type="stat.type"
            />
          </div>
        </section>

        <section>
          <Subtitle> {{ $t("home.recently_added") }} </Subtitle>
          <p
            v-if="itemsStatus === 'pending'"
            role="status"
            data-testid="items-state"
            data-state="pending"
            class="ml-2 text-sm"
          >
            {{ $t("home.items_loading") }}
          </p>
          <div
            v-else-if="itemsStatus === 'error'"
            role="alert"
            data-testid="items-state"
            data-state="error"
            class="ml-2 flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.items_failed") }}</p>
            <button
              type="button"
              data-testid="items-retry"
              class="font-medium text-primary underline"
              @click="retryItems"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <p v-else-if="recentItems.length === 0" data-testid="items-state" data-state="empty" class="ml-2 text-sm">
            {{ $t("items.no_results") }}
          </p>
          <BaseCard v-else-if="breakpoints.lg">
            <Table :items="recentItems" />
          </BaseCard>
          <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ItemCard v-for="item in recentItems" :key="item.id" :item="item" />
          </div>
        </section>

        <section>
          <Subtitle> {{ $t("home.storage_locations") }} </Subtitle>
          <p
            v-if="locationsState === 'pending'"
            role="status"
            data-testid="locations-state"
            data-state="pending"
            class="ml-2 text-sm"
          >
            {{ $t("home.locations_loading") }}
          </p>
          <div
            v-else-if="locationsState === 'error'"
            role="alert"
            data-testid="locations-state"
            data-state="error"
            class="ml-2 flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.locations_failed") }}</p>
            <button
              type="button"
              data-testid="locations-retry"
              class="font-medium text-primary underline"
              @click="retryLocations"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <p v-else-if="locations.length === 0" data-testid="locations-state" data-state="empty" class="ml-2 text-sm">
            {{ $t("locations.no_results") }}
          </p>
          <div
            v-else
            data-testid="locations-state"
            data-state="ready"
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
          >
            <LocationCard v-for="location in locations" :key="location.id" :location="location" />
          </div>
        </section>

        <section>
          <Subtitle> {{ $t("home.tags") }} </Subtitle>
          <p
            v-if="tagsState === 'pending'"
            role="status"
            data-testid="tags-state"
            data-state="pending"
            class="ml-2 text-sm"
          >
            {{ $t("home.tags_loading") }}
          </p>
          <div
            v-else-if="tagsState === 'error'"
            role="alert"
            data-testid="tags-state"
            data-state="error"
            class="ml-2 flex flex-wrap items-center gap-3 text-sm"
          >
            <p>{{ $t("home.tags_failed") }}</p>
            <button
              type="button"
              data-testid="tags-retry"
              class="font-medium text-primary underline"
              @click="retryTags"
            >
              {{ $t("home.retry") }}
            </button>
          </div>
          <p v-else-if="tags.length === 0" data-testid="tags-state" data-state="empty" class="ml-2 text-sm">
            {{ $t("tags.no_results") }}
          </p>
          <div v-else data-testid="tags-state" data-state="ready" class="flex flex-wrap gap-4">
            <TagChip v-for="tag in tags" :key="tag.id" size="lg" :tag="tag" class="shadow-md" />
          </div>
        </section>
      </div>
    </BaseContainer>
  </div>
</template>
