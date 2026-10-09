<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import { Input } from "~/components/ui/input";
  import type { EntitySummary, TagSummary } from "~~/lib/api/types/data-contracts";
  import { useTagStore } from "~/stores/tags";
  import { useLocationStore } from "~~/stores/locations";
  import MdiLoading from "~icons/mdi/loading";
  import MdiMagnify from "~icons/mdi/magnify";
  import MdiDelete from "~icons/mdi/delete";
  import { Button, ButtonGroup } from "@/components/ui/button";
  import { PURRFECT_DESKTOP_MEDIA_QUERY } from "~~/lib/inventory-context";
  import { searchPresentation } from "~~/lib/search-presentation";
  import {
    applySearchResponse,
    appliedFieldFilters,
    compatibleFieldFilters,
    compatibleSelections,
    createSearchGate,
    optionsAreActive,
    pageAfterChange,
    phaseWhileLoading,
    searchChips,
    type SearchChip,
    type SearchFilterState,
    type SearchPhase,
  } from "~~/lib/search-session";
  import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";
  import { Separator } from "@/components/ui/separator";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import BaseContainer from "@/components/Base/Container.vue";
  import SearchFilter from "~/components/Search/Filter.vue";
  import ItemViewSelectable from "~/components/Item/View/Selectable.vue";
  import type { LocationQueryRaw } from "vue-router";

  const { t } = useI18n();

  definePageMeta({
    middleware: ["auth"],
  });

  useHead({
    title: "HomeBox | " + t("global.items"),
  });

  const searchLocked = ref(false);
  const queryParamsInitialized = ref(false);
  const phase = ref<SearchPhase>("initial");
  const searchGate = createSearchGate();
  const resultsCollectionId = ref<string | null>(null);

  const api = useUserApi();
  const loading = useMinLoader(500);
  const items = ref<EntitySummary[]>([]);
  const total = ref(0);

  // Using useRouteQuery directly has two downsides
  // 1. It persists the default value in the query string
  // 2. The ref returned by useRouteQuery updates asynchronously after calling the setter.
  //    This can cause unintuitive behaviors.
  // -> We copy query parameters into separate refs on page load and update the query explicitly via `router.push`.
  type QueryParamValue = string | string[] | number | boolean;
  type QueryRef = Ref<boolean | string | string[] | number, boolean | string | string[] | number>;
  const queryParamDefaultValues: Record<string, QueryParamValue> = {};
  function useOptionalRouteQuery(key: string, defaultValue: string): Ref<string>;
  function useOptionalRouteQuery(key: string, defaultValue: string[]): Ref<string[]>;
  function useOptionalRouteQuery(key: string, defaultValue: number): Ref<number>;
  function useOptionalRouteQuery(key: string, defaultValue: boolean): Ref<boolean>;
  function useOptionalRouteQuery(key: string, defaultValue: QueryParamValue): QueryRef {
    queryParamDefaultValues[key] = defaultValue;
    if (typeof defaultValue === "string") {
      const val = useRouteQuery(key, defaultValue);
      return ref(val.value);
    }
    if (Array.isArray(defaultValue)) {
      const val = useRouteQuery(key, defaultValue);
      return ref(val.value);
    }
    if (typeof defaultValue === "number") {
      const val = useRouteQuery(key, defaultValue);
      return ref(val.value);
    }
    if (typeof defaultValue === "boolean") {
      const val = useRouteQuery(key, defaultValue);
      return ref(val.value);
    }

    throw Error(`Invalid query value type ${typeof defaultValue}`);
  }

  const page1 = useOptionalRouteQuery("page", 1);

  const page = computed({
    get: () => page1.value,
    set: value => {
      page1.value = value;
    },
  });

  const query = useOptionalRouteQuery("q", "");
  const includeArchived = useOptionalRouteQuery("archived", false);
  const fieldSelector = useOptionalRouteQuery("fieldSelector", false);
  const negateTags = useOptionalRouteQuery("negateTags", false);
  const onlyWithoutPhoto = useOptionalRouteQuery("onlyWithoutPhoto", false);
  const onlyWithPhoto = useOptionalRouteQuery("onlyWithPhoto", false);
  const orderBy = useOptionalRouteQuery("orderBy", "name");
  const qLoc = useOptionalRouteQuery("loc", []);
  const qTag = useOptionalRouteQuery("tag", []);

  const preferences = useViewPreferences();
  const pageSize = computed(() => preferences.value.itemsPerTablePage);
  const { theme } = useTheme();
  const isDesktop = useMediaQuery(PURRFECT_DESKTOP_MEDIA_QUERY);
  const { selectedId, selectedCollection } = useCollections();
  const activeCollection = computed(() => selectedId.value ?? preferences.value.collectionId ?? null);
  const purrfectDesktop = computed(() => theme.value === "purrfect-home" && isDesktop.value);

  const route = useRoute();
  const router = useRouter();

  const locationsStore = useLocationStore();

  const locationFlatTree = useFlatLocations();

  const locations = computed(() => locationsStore.allLocations);

  const tagStore = useTagStore();
  const tags = computed(() => tagStore.tags);

  const selectedLocations = ref<EntitySummary[]>([]);
  const selectedTags = ref<TagSummary[]>([]);

  const locIDs = computed(() => selectedLocations.value.map(l => l.id));
  const tagIDs = computed(() => selectedTags.value.map(l => l.id));

  function parseAssetIDString(d: string) {
    d = d.replace(/"/g, "").replace(/-/g, "");

    const aidInt = parseInt(d);
    if (isNaN(aidInt)) {
      return [-1, false];
    }

    return [aidInt, true];
  }

  const byAssetId = computed(() => query.value?.startsWith("#") || false);
  const parsedAssetId = computed(() => {
    if (!byAssetId.value) {
      return "";
    } else {
      const [aid, valid] = parseAssetIDString(query.value.replace("#", ""));
      if (!valid) {
        return t("items.invalid_asset_id");
      } else {
        return aid;
      }
    }
  });

  const fieldTuples = ref<[string, string][]>([]);
  const fieldValuesCache = ref<Record<string, string[]>>({});

  const allFields = ref<string[]>([]);
  const fieldSignature = computed(() =>
    appliedFieldFilters(fieldTuples.value)
      .map(field => `${field.field}=${field.value}`)
      .join("|")
  );

  const filterState = computed<SearchFilterState>(() => ({
    locations: selectedLocations.value,
    tags: selectedTags.value,
    includeArchived: Boolean(includeArchived.value),
    onlyWithPhoto: Boolean(onlyWithPhoto.value),
    onlyWithoutPhoto: Boolean(onlyWithoutPhoto.value),
    negateTags: Boolean(negateTags.value),
    orderBy: orderBy.value || "name",
    fields: appliedFieldFilters(fieldTuples.value),
  }));

  const presentation = computed(() =>
    searchPresentation({
      apiTotal: phase.value === "ready" || phase.value === "empty" ? total.value : 0,
      pageLength: phase.value === "ready" ? items.value.length : 0,
      query: query.value || "",
      byAssetId: byAssetId.value,
      assetIdLabel: String(parsedAssetId.value ?? ""),
      collectionName: selectedCollection.value?.name ?? "",
      locationFilterCount: selectedLocations.value.length,
      tagFilterCount: selectedTags.value.length,
      includeArchived: includeArchived.value,
      onlyWithPhoto: onlyWithPhoto.value,
      onlyWithoutPhoto: onlyWithoutPhoto.value,
      fieldFilterCount: filterState.value.fields.length,
      negateTags: negateTags.value,
      ordered: filterState.value.orderBy !== "name",
    })
  );

  const collectionLabel = computed(() => presentation.value.collectionName || t("purrfect.search_collection_fallback"));
  const optionsActive = computed(() => optionsAreActive(filterState.value));
  const chips = computed(() =>
    searchChips(filterState.value, {
      archived: t("purrfect.search_chip_archived"),
      withPhoto: t("purrfect.search_chip_with_photo"),
      withoutPhoto: t("purrfect.search_chip_without_photo"),
      negateTags: t("purrfect.search_chip_negate_tags"),
      order: order => t("purrfect.search_chip_order", { order: orderLabel(order) }),
      field: (field, value) => t("purrfect.search_chip_field", { field, value }),
    })
  );
  const headingState = computed(() => {
    if (phase.value === "initial") {
      return "loading";
    }
    return phase.value;
  });

  function orderLabel(order: string) {
    if (order === "createdAt") {
      return t("items.created_at");
    }
    if (order === "updatedAt") {
      return t("items.updated_at");
    }
    return t("items.name");
  }

  function idList(value: string | string[]): string[] {
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }
    return value ? [value] : [];
  }

  function setItemView(view: "card" | "table") {
    preferences.value.itemDisplayView = view;
  }

  function applyCompatibleSelections(locationIds: string[], tagIds: string[]) {
    selectedLocations.value = compatibleSelections(locationIds, locations.value).kept;
    selectedTags.value = compatibleSelections(tagIds, tags.value).kept;
    fieldTuples.value = compatibleFieldFilters(fieldTuples.value, allFields.value);
  }

  async function loadFields(collectionId: string | null) {
    const { data, error } = await api.items.fields.getAll();
    if (activeCollection.value !== collectionId) {
      return;
    }
    allFields.value = error || !Array.isArray(data) ? [] : data;
  }

  async function ensureLookups(collectionId: string | null) {
    const locationsStale = locationsStore.boundCollectionId !== collectionId || locationsStore.Locations === null;
    const tagsStale = tagStore.boundCollectionId !== collectionId || tagStore.allTags === null;
    if (locationsStale) {
      locationsStore.prepareForCollection(collectionId);
    }
    if (tagsStale) {
      tagStore.prepareForCollection(collectionId);
    }
    await Promise.all([
      locationsStale ? locationsStore.refreshChildren() : locationsStore.ensureLocationsFetched(),
      locationsStore.tree === null || locationsStore.boundCollectionId !== collectionId
        ? locationsStore.refreshTree()
        : Promise.resolve(),
      tagsStale ? tagStore.refresh() : tagStore.ensureAllTagsFetched(),
      loadFields(collectionId),
    ]);
  }

  function resetPageFor(change: "query" | "filter" | "pageSize") {
    if (!queryParamsInitialized.value || searchLocked.value) {
      return;
    }
    const next = pageAfterChange(page.value, change);
    if (next !== page.value) {
      page.value = next;
    }
  }

  watch(fieldSelector, (newV, oldV) => {
    if (newV === false && oldV === true) {
      fieldTuples.value = [];
    }
  });

  watch(onlyWithoutPhoto, newV => {
    if (newV && onlyWithPhoto.value) {
      onlyWithPhoto.value = false;
    }
  });

  watch(onlyWithPhoto, newV => {
    if (newV && onlyWithoutPhoto.value) {
      onlyWithoutPhoto.value = false;
    }
  });

  watch(
    [
      query,
      selectedTags,
      selectedLocations,
      includeArchived,
      negateTags,
      onlyWithoutPhoto,
      onlyWithPhoto,
      orderBy,
      fieldSignature,
    ],
    () => {
      resetPageFor("filter");
    }
  );

  watch(pageSize, () => {
    resetPageFor("pageSize");
  });

  watch(
    () => route.query.q,
    (newV, oldV) => {
      if (newV !== oldV) {
        query.value = (typeof newV === "string" ? newV : "") || "";
      }
    }
  );

  async function fetchValues(field: string): Promise<string[]> {
    if (!field) {
      return [];
    }
    if (fieldValuesCache.value[field]) {
      return fieldValuesCache.value[field];
    }

    const collectionId = activeCollection.value;
    const { data, error } = await api.items.fields.getAllValues(field);
    if (error || !data || activeCollection.value !== collectionId) {
      return [];
    }

    fieldValuesCache.value[field] = data;
    return data;
  }

  async function search() {
    if (searchLocked.value) {
      return;
    }

    const collectionId = activeCollection.value;
    if (searchGate.collectionId() !== collectionId) {
      searchGate.changeCollection(collectionId);
    }
    const token = searchGate.begin();
    const requestedPage = page.value;
    phase.value = phaseWhileLoading(phase.value);
    items.value = [];
    total.value = 0;
    loading.value = true;

    const fields = appliedFieldFilters(fieldTuples.value).map(field => `${field.field}=${field.value}`);

    const push_query: Record<string, string | string[] | number | boolean | undefined> = {
      archived: includeArchived.value,
      fieldSelector: fieldSelector.value,
      negateTags: negateTags.value,
      onlyWithoutPhoto: onlyWithoutPhoto.value,
      onlyWithPhoto: onlyWithPhoto.value,
      orderBy: orderBy.value,
      page: requestedPage,
      q: query.value,
      loc: locIDs.value,
      tag: tagIDs.value,
      fields: fields,
    };

    for (const key in push_query) {
      const val = push_query[key];
      const defaultVal = queryParamDefaultValues[key];
      if (
        (Array.isArray(val) &&
          Array.isArray(defaultVal) &&
          val.length == defaultVal.length &&
          val.every(v => (defaultVal as string[]).includes(v))) ||
        val === queryParamDefaultValues[key]
      ) {
        push_query[key] = undefined;
      }

      // Empirically seen to be unnecessary but according to router.push types,
      // booleans are not supported. This might be more stable.
      if (typeof push_query[key] === "boolean") {
        push_query[key] = String(val);
      }
    }

    await router.push({ query: push_query as LocationQueryRaw });
    if (!searchGate.accepts(token)) {
      return;
    }

    const { data, error } = await api.items.getAll({
      q: query.value || "",
      parentIds: locIDs.value,
      tags: tagIDs.value,
      negateTags: negateTags.value,
      onlyWithoutPhoto: onlyWithoutPhoto.value,
      onlyWithPhoto: onlyWithPhoto.value,
      includeArchived: includeArchived.value,
      page: requestedPage,
      pageSize: pageSize.value,
      orderBy: orderBy.value,
      fields,
    });

    const applied = applySearchResponse({
      accepts: searchGate.accepts(token),
      outcome: error || !data ? { ok: false } : { ok: true, items: data.items ?? [], total: data.total ?? 0 },
      requestedPage,
      pageSize: pageSize.value,
      collectionId,
    });

    if (!applied.accepted) {
      return;
    }

    if (applied.refetch) {
      searchLocked.value = true;
      page.value = applied.page;
      searchLocked.value = false;
      await search();
      return;
    }

    if (applied.page !== page.value) {
      searchLocked.value = true;
      page.value = applied.page;
      searchLocked.value = false;
    }

    if (applied.snapshot) {
      items.value = applied.snapshot.items;
      total.value = applied.snapshot.total;
      phase.value = applied.snapshot.phase;
      resultsCollectionId.value = applied.snapshot.collectionId;
    }
    loading.value = false;
    if (applied.snapshot?.phase === "error") {
      toast.error(t("items.toast.failed_search_items"));
    }
  }

  watchDebounced(
    [
      page,
      pageSize,
      query,
      selectedTags,
      selectedLocations,
      includeArchived,
      negateTags,
      onlyWithoutPhoto,
      onlyWithPhoto,
      orderBy,
      fieldSignature,
    ],
    () => {
      if (!queryParamsInitialized.value || searchLocked.value) {
        return;
      }
      void search();
    },
    { debounce: 250, maxWait: 1000 }
  );

  async function submit() {
    const next = pageAfterChange(page.value, "query");
    if (next !== page.value) {
      page.value = next;
    }
    await search();
  }

  async function reset() {
    searchLocked.value = true;
    query.value = "";
    includeArchived.value = false;
    fieldSelector.value = false;
    negateTags.value = false;
    onlyWithoutPhoto.value = false;
    onlyWithPhoto.value = false;
    orderBy.value = "name";
    selectedLocations.value = [];
    selectedTags.value = [];
    fieldTuples.value = [];
    page.value = 1;
    searchLocked.value = false;
    await search();
  }

  async function retrySearch() {
    await search();
  }

  function removeChip(chip: SearchChip) {
    if (chip.kind === "location") {
      selectedLocations.value = selectedLocations.value.filter(location => location.id !== chip.id);
      return;
    }
    if (chip.kind === "tag") {
      selectedTags.value = selectedTags.value.filter(tag => tag.id !== chip.id);
      return;
    }
    if (chip.kind === "archived") {
      includeArchived.value = false;
      return;
    }
    if (chip.kind === "with-photo") {
      onlyWithPhoto.value = false;
      return;
    }
    if (chip.kind === "without-photo") {
      onlyWithoutPhoto.value = false;
      return;
    }
    if (chip.kind === "negate-tags") {
      negateTags.value = false;
      return;
    }
    if (chip.kind === "order") {
      orderBy.value = "name";
      return;
    }
    if (chip.kind === "field") {
      fieldTuples.value = fieldTuples.value.filter(tuple => `${tuple[0]}=${tuple[1]}` !== chip.id);
    }
  }

  async function onCollectionChange(id: string | null) {
    searchLocked.value = true;
    searchGate.changeCollection(id);
    const requestedLocations = selectedLocations.value.map(location => location.id);
    const requestedTags = selectedTags.value.map(tag => tag.id);
    phase.value = "initial";
    items.value = [];
    total.value = 0;
    resultsCollectionId.value = null;
    fieldValuesCache.value = {};
    selectedLocations.value = [];
    selectedTags.value = [];
    page.value = 1;
    await ensureLookups(id);
    if (activeCollection.value !== id) {
      searchLocked.value = false;
      return;
    }
    applyCompatibleSelections(requestedLocations, requestedTags);
    searchLocked.value = false;
    await search();
  }

  watch(activeCollection, (id, previous) => {
    if (!queryParamsInitialized.value || id === previous) {
      return;
    }
    void onCollectionChange(id);
  });

  onMounted(async () => {
    loading.value = true;
    searchLocked.value = true;
    const collectionId = activeCollection.value;
    searchGate.changeCollection(collectionId);
    await ensureLookups(collectionId);
    if (activeCollection.value !== collectionId) {
      searchLocked.value = false;
      return;
    }

    const qFields = route.query.fields;
    const fieldList = Array.isArray(qFields) ? qFields : qFields ? [String(qFields)] : [];
    fieldTuples.value = fieldList.map(field => {
      const [name, ...rest] = String(field).split("=");
      return [name || "", rest.join("=")] as [string, string];
    });
    fieldTuples.value = compatibleFieldFilters(fieldTuples.value, allFields.value);
    for (const tuple of fieldTuples.value) {
      if (tuple[0] && tuple[1]) {
        await fetchValues(tuple[0]);
      }
    }
    if (activeCollection.value !== collectionId) {
      searchLocked.value = false;
      return;
    }

    applyCompatibleSelections(idList(qLoc.value), idList(qTag.value));
    queryParamsInitialized.value = true;
    searchLocked.value = false;
    await search();
    window.scroll({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  });

  const pagination = proxyRefs({
    page,
    pageSize,
    totalSize: total,
    setPage: (newPage: number) => {
      page.value = newPage;
    },
  });
</script>

<template>
  <BaseContainer>
    <div v-if="purrfectDesktop" data-testid="purrfect-search-results" class="mb-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{{ collectionLabel }}</span>
        <span aria-hidden="true"> / </span>
        {{ $t("purrfect.search_crumb") }}
      </p>
      <h1
        class="mt-2 text-4xl font-semibold tracking-tight text-foreground"
        data-testid="search-heading"
        :data-count="phase === 'ready' || phase === 'empty' ? presentation.count : ''"
        :data-mode="presentation.mode"
        :data-state="headingState"
        :data-phase="phase"
      >
        <template v-if="phase === 'initial'">
          {{ $t("purrfect.search_loading") }}
        </template>
        <template v-else-if="phase === 'refreshing'">
          {{ $t("purrfect.search_refreshing") }}
        </template>
        <template v-else-if="phase === 'error'">
          {{ $t("purrfect.search_error_heading") }}
        </template>
        <template v-else-if="phase === 'empty' && presentation.mode === 'browse'">
          {{ $t("purrfect.search_empty_browse", { collection: collectionLabel }) }}
        </template>
        <template v-else-if="phase === 'empty'">
          {{ $t("purrfect.search_empty_query", { query: presentation.query || presentation.assetIdLabel }) }}
        </template>
        <template v-else-if="presentation.mode === 'asset'">
          {{ $t("purrfect.search_asset_heading", { count: presentation.count, id: presentation.assetIdLabel }) }}
        </template>
        <template v-else-if="presentation.mode === 'match'">
          {{ $t("purrfect.search_match_heading", { count: presentation.count, query: presentation.query }) }}
        </template>
        <template v-else>
          {{ $t("purrfect.search_browse_heading", { count: presentation.count }) }}
        </template>
      </h1>
      <p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground" data-testid="search-behavior">
        <template v-if="presentation.mode === 'asset'">
          {{ $t("purrfect.search_behavior_asset", { id: presentation.assetIdLabel, collection: collectionLabel }) }}
        </template>
        <template v-else-if="presentation.filtersApplied">
          {{ $t("purrfect.search_behavior_filtered", { collection: collectionLabel }) }}
        </template>
        <template v-else-if="presentation.mode === 'browse'">
          {{ $t("purrfect.search_behavior_browse", { collection: collectionLabel }) }}
        </template>
        <template v-else>
          {{ $t("purrfect.search_behavior", { collection: collectionLabel }) }}
        </template>
      </p>
    </div>

    <div v-if="locations && tags">
      <div v-if="!purrfectDesktop" class="flex flex-wrap items-end gap-4 md:flex-nowrap">
        <div class="w-full">
          <Input
            v-model:model-value="query"
            data-testid="items-search"
            :placeholder="$t('global.search')"
            class="h-12"
          />
          <div v-if="byAssetId" class="pl-2 pt-2 text-sm">
            <p>{{ $t("items.query_id", { id: parsedAssetId }) }}</p>
          </div>
        </div>
        <Button class="mb-auto h-12 w-full md:w-auto" type="button" @click.prevent="submit">
          <MdiLoading v-if="loading" class="animate-spin" />
          <MdiMagnify v-else />
          {{ $t("global.search") }}
        </Button>
      </div>

      <div class="flex w-full flex-wrap items-center gap-2 py-2 md:flex-nowrap">
        <SearchFilter
          v-model="selectedLocations"
          :label="$t('global.locations')"
          :options="locationFlatTree"
          :trigger-class="purrfectDesktop ? 'h-9 rounded-full px-4' : ''"
          :highlight-active="purrfectDesktop"
          test-id="search-locations"
        />
        <SearchFilter
          v-model="selectedTags"
          :label="$t('global.tags')"
          :options="tags"
          :trigger-class="purrfectDesktop ? 'h-9 rounded-full px-4' : ''"
          :highlight-active="purrfectDesktop"
          test-id="search-tags"
        />
        <Popover>
          <PopoverTrigger as-child>
            <Button
              size="sm"
              :variant="optionsActive ? 'default' : 'outline'"
              type="button"
              data-testid="search-options"
              :data-active="optionsActive ? 'true' : 'false'"
              :aria-pressed="optionsActive"
              :class="purrfectDesktop ? 'h-9 rounded-full px-4' : undefined"
            >
              {{ $t("items.options") }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="z-40 flex flex-col gap-2">
            <Label class="flex cursor-pointer items-center">
              <Switch v-model="includeArchived" class="ml-auto" />
              <div class="grow" />
              <span class="text-right"> {{ $t("items.include_archive") }} </span>
            </Label>
            <Label class="flex cursor-pointer items-center">
              <Switch v-model="fieldSelector" class="ml-auto" />
              <div class="grow" />
              <span class="text-right"> {{ $t("items.field_selector") }} </span>
            </Label>
            <Label class="flex cursor-pointer items-center">
              <Switch v-model="negateTags" class="ml-auto" />
              <div class="grow" />
              <span class="text-right"> {{ $t("items.negate_tags") }} </span>
            </Label>
            <Label class="flex cursor-pointer items-center">
              <Switch v-model="onlyWithoutPhoto" class="ml-auto" />
              <div class="grow" />
              <span class="text-right"> {{ $t("items.only_without_photo") }} </span>
            </Label>
            <Label class="flex cursor-pointer items-center">
              <Switch v-model="onlyWithPhoto" class="ml-auto" />
              <div class="grow" />
              <span class="text-right"> {{ $t("items.only_with_photo") }} </span>
            </Label>
            <Label class="flex cursor-pointer flex-col gap-2">
              <span class="text-right">
                <span class="text-right"> {{ $t("items.order_by") }} </span>
              </span>

              <Select v-model="orderBy">
                <SelectTrigger>
                  <SelectValue :placeholder="$t('items.order_by')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name"> {{ $t("items.name") }} </SelectItem>
                  <SelectItem value="createdAt"> {{ $t("items.created_at") }} </SelectItem>
                  <SelectItem value="updatedAt"> {{ $t("items.updated_at") }} </SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <Separator />
            <Button type="button" @click="reset"> {{ $t("items.reset_search") }} </Button>
          </PopoverContent>
        </Popover>
        <div class="grow" />
        <ButtonGroup
          v-if="purrfectDesktop"
          data-testid="view-toggle"
          class="rounded-full"
          role="group"
          :aria-label="$t('purrfect.view_toggle')"
        >
          <Button
            size="sm"
            type="button"
            :variant="preferences.itemDisplayView === 'card' ? 'default' : 'outline'"
            :aria-pressed="preferences.itemDisplayView === 'card'"
            @click="setItemView('card')"
          >
            {{ $t("purrfect.cards") }}
          </Button>
          <Button
            size="sm"
            type="button"
            :variant="preferences.itemDisplayView === 'table' ? 'default' : 'outline'"
            :aria-pressed="preferences.itemDisplayView === 'table'"
            @click="setItemView('table')"
          >
            {{ $t("purrfect.table") }}
          </Button>
        </ButtonGroup>
        <Popover v-if="!purrfectDesktop">
          <PopoverTrigger as-child>
            <Button size="sm" variant="outline"> {{ $t("items.tips") }}</Button>
          </PopoverTrigger>
          <PopoverContent class="z-40 w-[325px]" align="end">
            <p class="text-base">{{ $t("items.tips_sub") }}</p>
            <ul class="mt-1 list-disc pl-6 text-sm">
              <li>
                {{ $t("items.tip_1") }}
              </li>
              <li>
                {{ $t("items.tip_2") }}
              </li>
              <li>
                {{ $t("items.tip_3") }}
              </li>
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <div v-if="fieldSelector" class="flex flex-col gap-2 pb-2">
        <p>{{ $t("items.custom_fields") }}</p>
        <div v-for="(f, idx) in fieldTuples" :key="idx" class="flex flex-wrap gap-2">
          <div class="flex w-full flex-col gap-1 md:w-auto md:grow">
            <Label> {{ $t("items.field") }} </Label>
            <Select v-model="fieldTuples[idx]![0]" @update:model-value="fetchValues(f[0])">
              <SelectTrigger>
                <SelectValue :placeholder="$t('items.select_field')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="field in allFields" :key="field" :value="field"> {{ field }} </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex w-full flex-col gap-1 md:w-auto md:grow">
            <Label> {{ $t("items.field_value") }} </Label>
            <Select v-model="fieldTuples[idx]![1]">
              <SelectTrigger>
                <SelectValue :placeholder="$t('items.select_value')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="value in fieldValuesCache[f[0]]" :key="value" :value="value">
                  {{ value }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="destructive" type="button" size="icon" class="my-auto" @click="fieldTuples.splice(idx, 1)">
            <MdiDelete />
          </Button>
        </div>
        <Button type="button" size="sm" class="mt-2" @click="() => fieldTuples.push(['', ''])">
          {{ $t("items.add") }}
        </Button>
      </div>
      <ul v-if="chips.length" data-testid="search-chips" class="flex flex-wrap gap-2 pb-2">
        <li v-for="chip in chips" :key="chip.key">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            class="h-8 rounded-full"
            data-testid="search-chip"
            :data-chip-kind="chip.kind"
            :data-chip-id="chip.id || undefined"
            :aria-label="$t('purrfect.search_chip_remove', { label: chip.label })"
            @click="removeChip(chip)"
          >
            <span>{{ chip.label }}</span>
            <span aria-hidden="true">×</span>
          </Button>
        </li>
      </ul>
    </div>

    <div
      v-if="phase !== 'ready'"
      data-testid="search-status"
      class="mb-4 rounded-lg border bg-card p-4"
      role="status"
      :data-phase="phase"
      :aria-busy="phase === 'initial' || phase === 'refreshing'"
    >
      <p class="font-medium text-foreground">
        <template v-if="phase === 'initial'">{{ $t("purrfect.search_loading") }}</template>
        <template v-else-if="phase === 'refreshing'">{{ $t("purrfect.search_refreshing") }}</template>
        <template v-else-if="phase === 'error'">{{ $t("purrfect.search_error_heading") }}</template>
        <template v-else-if="presentation.mode === 'browse'">
          {{ $t("purrfect.search_empty_browse", { collection: collectionLabel }) }}
        </template>
        <template v-else>
          {{ $t("purrfect.search_empty_query", { query: presentation.query || presentation.assetIdLabel }) }}
        </template>
      </p>
      <p v-if="phase === 'empty' || phase === 'error'" class="mt-1 text-sm text-muted-foreground">
        {{
          phase === "error"
            ? $t("purrfect.search_error_body")
            : $t("purrfect.search_empty_body", { collection: collectionLabel })
        }}
      </p>
      <div v-if="phase === 'empty' || phase === 'error'" class="mt-3 flex flex-wrap gap-2">
        <Button v-if="phase === 'error'" type="button" data-testid="search-retry" @click="retrySearch">
          {{ $t("purrfect.search_retry") }}
        </Button>
        <Button type="button" variant="outline" data-testid="search-reset" @click="reset">
          {{ $t("purrfect.search_reset") }}
        </Button>
      </div>
    </div>

    <div
      v-if="purrfectDesktop"
      id="selectable-subtitle"
      class="mb-3 flex items-center gap-2"
      :class="{ hidden: !preferences.quickActions.enabled }"
    />

    <section
      :data-item-view="preferences.itemDisplayView"
      :data-search-phase="phase"
      :data-page="page"
      :data-total="phase === 'ready' || phase === 'empty' ? total : ''"
      :data-results-collection="resultsCollectionId || ''"
      data-testid="search-results-region"
    >
      <ItemViewSelectable
        v-if="!purrfectDesktop || (phase === 'ready' && resultsCollectionId === activeCollection)"
        :items="phase === 'ready' && resultsCollectionId === activeCollection ? items : []"
        :location-flat-tree="locationFlatTree"
        :pagination="pagination"
        :hide-header="purrfectDesktop"
        disable-sort
        @refresh="async () => search()"
      />
    </section>

    <p
      v-if="purrfectDesktop && phase === 'ready'"
      class="mt-4 text-sm text-muted-foreground"
      data-testid="search-showing"
    >
      {{ $t("purrfect.search_showing", { shown: items.length, total: presentation.count }) }}
    </p>
  </BaseContainer>
</template>
