<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import type { EntityOut, ItemAttachment } from "~~/lib/api/types/data-contracts";
  import type { AnyDetail, Details } from "~~/components/global/DetailsSection/types";
  import { filterZeroValues } from "~~/components/global/DetailsSection/types";
  import {
    LOCATION_BROWSE_PAGE_SIZE,
    activePlaceId,
    ancestorLocations,
    browseRecordFromSummary,
    childRecordCounts,
    continueLocationWalk,
    createLocationWalk,
    directLocationChildren,
    formatQuantityValue,
    groupBelongings,
    locationRefs,
    nextLocationQuery,
    reduceLocationWalk,
    subtreeLocationIds,
    visibleQuantitySum,
    visibleRecordCount,
    walkIsComplete,
    withRouteLocation,
    type LocationRef,
    type LocationWalk,
  } from "~~/lib/location-browse";
  import { useInventoryNavigation } from "~~/composables/use-inventory-navigation";
  import MdiPlus from "~icons/mdi/plus";
  import MdiPackageVariant from "~icons/mdi/package-variant";
  import MdiPencil from "~icons/mdi/pencil";
  import MdiDelete from "~icons/mdi/delete";
  import { Button } from "@/components/ui/button";
  import BaseCard from "@/components/Base/Card.vue";
  import Markdown from "~/components/global/Markdown.vue";
  import LabelMaker from "~/components/global/LabelMaker.vue";
  import DetailsSection from "~/components/global/DetailsSection/DetailsSection.vue";
  import ItemAttachmentsList from "~/components/Item/AttachmentsList.vue";
  import LocationInventoryRows from "~/components/Location/InventoryRows.vue";

  const props = defineProps<{
    location: EntityOut;
    collectionName: string;
    collectionId: string | null;
  }>();

  const { t } = useI18n();
  const confirm = useConfirm();
  const { launchAddItem } = useInventoryNavigation();
  const preferences = useViewPreferences();

  type Phase = "loading" | "partial" | "ready" | "empty" | "error";

  const selectedChildId = ref<string | null>(null);
  const indexStatus = ref<"loading" | "ready" | "error">("loading");
  const locationIndex = ref<LocationRef[]>([]);
  const collectionLocationCount = ref<number | null>(null);
  const roomWalk = ref<LocationWalk>(createLocationWalk([]));
  const childWalk = ref<LocationWalk>(createLocationWalk([]));
  const roomPhase = ref<Phase>("loading");
  const childPhase = ref<Phase>("loading");

  let roomToken = 0;
  let childToken = 0;
  let indexToken = 0;

  const places = computed(() =>
    directLocationChildren(props.location.id, locationIndex.value, props.location.children ?? [])
  );
  const childIds = computed(() => places.value.map(place => place.id));
  const activeChild = computed(() => activePlaceId(selectedChildId.value, childIds.value));
  const ancestors = computed(() => ancestorLocations(props.location.id, locationIndex.value));
  const displayWalk = computed(() => (activeChild.value ? childWalk.value : roomWalk.value));
  const displayPhase = computed(() => (activeChild.value ? childPhase.value : roomPhase.value));
  const roomRecords = computed(() => visibleRecordCount(roomWalk.value));
  const roomQuantity = computed(() => visibleQuantitySum(roomWalk.value));
  const subsetRecords = computed(() => (activeChild.value ? visibleRecordCount(childWalk.value) : null));
  const placeCounts = computed(() => {
    if (!walkIsComplete(roomWalk.value)) {
      return null;
    }
    return childRecordCounts(roomWalk.value.loaded, places.value, locationIndex.value);
  });
  const displayGroups = computed(() => {
    if (!walkIsComplete(displayWalk.value)) {
      return [];
    }
    return groupBelongings(displayWalk.value.loaded, locationIndex.value, activeChild.value ?? props.location.id);
  });
  const dataState = computed(() => {
    if (indexStatus.value === "loading") {
      return "loading";
    }
    if (indexStatus.value === "error") {
      return "error";
    }
    if (displayPhase.value === "ready" && displayWalk.value.loaded.length === 0) {
      return "empty";
    }
    return displayPhase.value;
  });
  const activePlaceName = computed(
    () => places.value.find(place => place.id === activeChild.value)?.name ?? props.location.name
  );

  const collectionLabel = computed(() => props.collectionName.trim() || t("purrfect.search_collection_fallback"));

  function phaseFor(walk: LocationWalk): Phase {
    if (walk.status === "error") {
      return "error";
    }
    if (!walkIsComplete(walk)) {
      return walk.paused ? "partial" : "loading";
    }
    return walk.loaded.length === 0 ? "empty" : "ready";
  }

  async function fetchPage(query: { parentIds: string[]; page: number; pageSize: number }) {
    const api = useUserApi();
    const resp = await api.items.getAll({
      parentIds: query.parentIds,
      page: query.page,
      pageSize: query.pageSize,
    });
    if (resp.error || !resp.data || !Number.isFinite(resp.data.total)) {
      return null;
    }
    const items = (resp.data.items ?? []).flatMap(item => {
      const record = browseRecordFromSummary(item);
      return record ? [record] : [];
    });
    return { items, total: resp.data.total, page: query.page, pageSize: query.pageSize };
  }

  async function pump(which: "room" | "child") {
    const token = which === "room" ? roomToken : childToken;
    const collectionAtStart = props.collectionId;
    const locationAtStart = props.location.id;
    while (token === (which === "room" ? roomToken : childToken) && props.collectionId === collectionAtStart) {
      const walk = which === "room" ? roomWalk.value : childWalk.value;
      const query = nextLocationQuery(walk);
      if (!query) {
        const phase = phaseFor(walk);
        if (which === "room") {
          roomPhase.value = phase;
        } else {
          childPhase.value = phase;
        }
        return;
      }
      const page = await fetchPage(query);
      if (
        token !== (which === "room" ? roomToken : childToken) ||
        props.collectionId !== collectionAtStart ||
        props.location.id !== locationAtStart
      ) {
        return;
      }
      if (!page) {
        const failed = { ...walk, status: "error" as const, paused: true };
        if (which === "room") {
          roomWalk.value = failed;
          roomPhase.value = "error";
        } else {
          childWalk.value = failed;
          childPhase.value = "error";
        }
        return;
      }
      const next = reduceLocationWalk(walk, page);
      if (which === "room") {
        roomWalk.value = next;
        roomPhase.value = phaseFor(next);
      } else {
        childWalk.value = next;
        childPhase.value = phaseFor(next);
      }
      if (next.paused || next.status === "error" || walkIsComplete(next)) {
        return;
      }
    }
  }

  function startChildWalk() {
    const child = activeChild.value;
    childToken += 1;
    if (!child) {
      childWalk.value = createLocationWalk([]);
      childPhase.value = "ready";
      return;
    }
    childWalk.value = createLocationWalk(subtreeLocationIds(child, locationIndex.value));
    childPhase.value = "loading";
    void pump("child");
  }

  async function loadIndexAndRoom() {
    const token = ++indexToken;
    roomToken += 1;
    childToken += 1;
    const locationAtStart = props.location.id;
    const collectionAtStart = props.collectionId;
    indexStatus.value = "loading";
    roomPhase.value = "loading";
    roomWalk.value = createLocationWalk([]);
    childWalk.value = createLocationWalk([]);
    const api = useUserApi();
    const resp = await api.items.getLocations({ filterChildren: false });
    if (token !== indexToken || props.location.id !== locationAtStart || props.collectionId !== collectionAtStart) {
      return;
    }
    if (resp.error) {
      indexStatus.value = "error";
      collectionLocationCount.value = null;
      locationIndex.value = [];
      return;
    }
    const summaries = resp.data ?? [];
    collectionLocationCount.value = locationRefs(summaries).length;
    locationIndex.value = withRouteLocation(locationRefs(summaries), {
      id: props.location.id,
      name: props.location.name,
      parentId: props.location.parent?.id ?? null,
    });
    indexStatus.value = "ready";
    roomWalk.value = createLocationWalk(subtreeLocationIds(props.location.id, locationIndex.value));
    roomPhase.value = "loading";
    if (activeChild.value) {
      startChildWalk();
    }
    void pump("room");
  }

  watch(
    () => [props.location.id, props.collectionId] as const,
    () => {
      selectedChildId.value = null;
      void loadIndexAndRoom();
    },
    { immediate: true }
  );

  function selectPlace(id: string | null) {
    if (id == null || id === activeChild.value) {
      selectedChildId.value = null;
      return;
    }
    if (!childIds.value.includes(id)) {
      selectedChildId.value = null;
      return;
    }
    selectedChildId.value = id;
    startChildWalk();
  }

  function loadMore() {
    if (activeChild.value) {
      childWalk.value = continueLocationWalk(childWalk.value);
      childPhase.value = "loading";
      void pump("child");
    } else {
      roomWalk.value = continueLocationWalk(roomWalk.value);
      roomPhase.value = "loading";
      void pump("room");
    }
  }

  function addHere() {
    // Destination and return context are story 3. This opens the existing dialog
    // and does not guess a shelf.
    launchAddItem();
  }

  function goToEdit() {
    navigateTo(`/location/${props.location.id}/edit`);
  }

  async function confirmDelete() {
    const { isCanceled } = await confirm.open(t("locations.location_items_delete_confirm"));
    if (isCanceled) {
      return;
    }
    const { error } = await useUserApi().items.deleteLocation(props.location.id);
    if (error) {
      toast.error(t("locations.toast.failed_delete_location"));
      return;
    }
    toast.success(t("locations.toast.location_deleted"));
    navigateTo("/locations");
  }

  function placeCount(id: string): number | null {
    return placeCounts.value?.get(id) ?? null;
  }

  const photos = computed(() => {
    return (props.location.attachments ?? []).flatMap(attachment => {
      if (attachment.type !== "photo") {
        return [];
      }
      const originalSrc = useUserApi().authURL(`/entities/${props.location.id}/attachments/${attachment.id}`);
      return [
        {
          originalSrc,
          thumbnailSrc: attachment.thumbnail
            ? useUserApi().authURL(`/entities/${props.location.id}/attachments/${attachment.thumbnail.id}`)
            : originalSrc,
        },
      ];
    });
  });

  const nonPhotoAttachments = computed(() => {
    const buckets = {
      attachments: [] as ItemAttachment[],
      warranty: [] as ItemAttachment[],
      manuals: [] as ItemAttachment[],
      receipts: [] as ItemAttachment[],
    };
    for (const attachment of props.location.attachments ?? []) {
      if (attachment.type === "photo") {
        continue;
      }
      if (attachment.type === "warranty") {
        buckets.warranty.push(attachment);
      } else if (attachment.type === "manual") {
        buckets.manuals.push(attachment);
      } else if (attachment.type === "receipt") {
        buckets.receipts.push(attachment);
      } else {
        buckets.attachments.push(attachment);
      }
    }
    return buckets;
  });

  const hasNonPhotoAttachments = computed(() => {
    const buckets = nonPhotoAttachments.value;
    return buckets.attachments.length + buckets.warranty.length + buckets.manuals.length + buckets.receipts.length > 0;
  });

  const locationDetails = computed<Details>(() => {
    const rows: Details = [
      { name: "items.notes", type: "markdown", text: props.location.notes },
      ...(props.location.fields ?? []).map(field => ({ name: field.name, text: field.textValue }) as AnyDetail),
    ];
    return preferences.value.showEmpty ? rows : filterZeroValues(rows);
  });

  const showMore = computed(
    () =>
      Boolean(props.location.description) ||
      photos.value.length > 0 ||
      hasNonPhotoAttachments.value ||
      locationDetails.value.length > 0
  );
</script>

<template>
  <div
    data-testid="purrfect-location"
    :data-state="dataState"
    :data-location-id="location.id"
    :data-page-size="LOCATION_BROWSE_PAGE_SIZE"
  >
    <Title>{{ location.name }}</Title>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <nav
          class="text-xs text-muted-foreground"
          data-testid="location-breadcrumb"
          :aria-label="$t('purrfect.location_path')"
        >
          <NuxtLink to="/home" class="hover:underline">{{ collectionLabel }}</NuxtLink>
          <template v-for="crumb in ancestors" :key="crumb.id">
            <span aria-hidden="true"> / </span>
            <NuxtLink :to="`/location/${crumb.id}`" class="hover:underline">{{ crumb.name }}</NuxtLink>
          </template>
          <span aria-hidden="true"> / </span>
          <span>{{ location.name }}</span>
        </nav>
        <h1 class="mt-2 text-4xl font-semibold tracking-tight text-foreground" data-testid="location-heading">
          {{ location.name }}
        </h1>
        <p
          class="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground"
          data-testid="location-counts"
          :data-records="roomRecords == null ? '' : String(roomRecords)"
          :data-quantity="roomQuantity == null ? '' : formatQuantityValue(roomQuantity)"
          :data-places="String(places.length)"
          :data-count-kind="roomRecords == null ? 'unknown' : 'records'"
        >
          <span data-testid="location-record-count">
            <template v-if="roomRecords == null">{{ $t("purrfect.place_loading") }}</template>
            <template v-else>{{ $t("purrfect.place_records", { count: roomRecords }) }}</template>
          </span>
          <template v-if="roomQuantity != null">
            <span aria-hidden="true">·</span>
            <span data-testid="location-quantity">{{
              $t("purrfect.place_quantity", { count: formatQuantityValue(roomQuantity) })
            }}</span>
          </template>
          <template v-if="places.length > 0">
            <span aria-hidden="true">·</span>
            <span data-testid="location-places">{{
              $t("purrfect.place_places_inside", { count: places.length })
            }}</span>
          </template>
          <template v-if="collectionLocationCount != null">
            <span aria-hidden="true">·</span>
            <span data-testid="location-collection-count">{{
              $t("purrfect.place_part_of", { count: collectionLocationCount, collection: collectionLabel })
            }}</span>
          </template>
        </p>
      </div>
      <Button class="rounded-full" data-testid="add-item-here" @click="addHere">
        <MdiPlus />
        {{ $t("purrfect.place_add_here") }}
      </Button>
    </div>

    <div v-if="places.length > 0" class="mt-6 grid gap-3 sm:grid-cols-2" data-testid="place-selectors">
      <button
        type="button"
        class="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left"
        :class="activeChild == null ? 'border-2 border-primary' : 'border-border'"
        data-testid="whole-room"
        :data-active="activeChild == null ? 'true' : 'false'"
        :aria-pressed="activeChild == null"
        @click="selectPlace(null)"
      >
        <span
          class="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"
          aria-hidden="true"
        >
          <MdiPackageVariant class="size-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-semibold">{{ $t("purrfect.place_whole") }}</span>
          <span v-if="roomRecords != null" class="text-sm text-muted-foreground" data-testid="whole-room-count">
            {{ $t("purrfect.place_records", { count: roomRecords }) }}
          </span>
        </span>
        <span class="text-sm font-semibold" :class="activeChild == null ? 'text-primary' : 'text-muted-foreground'">
          {{ activeChild == null ? $t("purrfect.place_showing") : $t("purrfect.place_open") }}
        </span>
      </button>
      <button
        v-for="place in places"
        :key="place.id"
        type="button"
        class="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left"
        :class="activeChild === place.id ? 'border-2 border-primary' : 'border-border'"
        data-testid="place-selector"
        :data-place-id="place.id"
        :data-active="activeChild === place.id ? 'true' : 'false'"
        :aria-pressed="activeChild === place.id"
        @click="selectPlace(place.id)"
      >
        <span
          class="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"
          aria-hidden="true"
        >
          <MdiPackageVariant class="size-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block break-words font-semibold">{{ place.name }}</span>
          <span
            v-if="placeCount(place.id) != null"
            class="text-sm text-muted-foreground"
            data-testid="place-count"
            data-count-kind="records"
          >
            {{ $t("purrfect.place_records", { count: placeCount(place.id) ?? 0 }) }}
          </span>
        </span>
        <span
          class="text-sm font-semibold"
          :class="activeChild === place.id ? 'text-primary' : 'text-muted-foreground'"
        >
          {{ activeChild === place.id ? $t("purrfect.place_showing") : $t("purrfect.place_open") }}
        </span>
      </button>
    </div>

    <div class="mt-6 flex items-end justify-between gap-3">
      <h2 class="text-lg font-semibold" data-testid="location-section-title">{{ activePlaceName }}</h2>
      <p v-if="dataState === 'ready'" class="text-xs text-muted-foreground">{{ $t("purrfect.place_sorted") }}</p>
    </div>

    <p v-if="dataState === 'loading'" class="mt-4 text-sm text-muted-foreground" data-testid="location-loading">
      {{ $t("purrfect.place_loading") }}
    </p>
    <div
      v-else-if="dataState === 'error'"
      class="mt-4 rounded-2xl border border-border bg-card p-4"
      data-testid="location-error"
    >
      <p class="text-sm">{{ $t("purrfect.place_error") }}</p>
      <Button class="mt-3" variant="outline" data-testid="location-retry" @click="loadIndexAndRoom">
        {{ $t("purrfect.place_retry") }}
      </Button>
    </div>
    <p v-else-if="dataState === 'empty'" class="mt-4 text-sm text-muted-foreground" data-testid="location-empty">
      {{ activeChild ? $t("purrfect.place_empty_named", { place: activePlaceName }) : $t("purrfect.place_empty") }}
    </p>
    <template v-else>
      <p v-if="dataState === 'partial'" class="mb-3 text-sm text-muted-foreground" data-testid="location-partial">
        {{ $t("purrfect.place_partial", { shown: displayWalk.loaded.length }) }}
      </p>
      <LocationInventoryRows
        :complete="walkIsComplete(displayWalk)"
        :groups="displayGroups"
        :partial-items="displayWalk.loaded"
      />
      <Button
        v-if="dataState === 'partial'"
        class="mt-4"
        variant="outline"
        data-testid="location-load-more"
        @click="loadMore"
      >
        {{ $t("purrfect.place_load_more") }}
      </Button>
    </template>

    <p
      v-if="activeChild && subsetRecords != null && roomRecords != null"
      class="mt-4 text-sm text-muted-foreground"
      data-testid="location-subset"
      :data-subset="String(subsetRecords)"
      :data-room="String(roomRecords)"
    >
      {{ $t("purrfect.place_subset", { subset: subsetRecords, total: roomRecords }) }}
    </p>

    <details class="mt-8 rounded-2xl border border-border bg-card px-4 py-3" data-testid="location-more">
      <summary class="cursor-pointer text-sm font-semibold">{{ $t("purrfect.place_more") }}</summary>
      <div class="mt-4 flex flex-wrap gap-2">
        <span data-testid="location-labels"><LabelMaker :id="location.id" type="location" /></span>
        <Button variant="outline" data-testid="location-edit" @click="goToEdit">
          <MdiPencil />
          {{ $t("global.edit") }}
        </Button>
        <Button variant="destructive" data-testid="location-delete" @click="confirmDelete">
          <MdiDelete />
          {{ $t("global.delete") }}
        </Button>
      </div>
      <Markdown v-if="location.description" class="mt-4 text-sm" :source="location.description" />
      <div v-if="photos.length > 0" class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="location-photos">
        <img
          v-for="(photo, index) in photos"
          :key="index"
          :src="photo.thumbnailSrc || photo.originalSrc"
          :alt="location.name"
          class="h-24 w-full rounded-lg object-cover"
        />
      </div>
      <BaseCard v-if="locationDetails.length > 0" class="mt-4">
        <template #title>{{ $t("global.details") }}</template>
        <DetailsSection :details="locationDetails" />
      </BaseCard>
      <BaseCard v-if="hasNonPhotoAttachments" class="mt-4">
        <template #title>{{ $t("items.attachments") }}</template>
        <div class="border-t px-4 py-2">
          <ItemAttachmentsList
            v-if="nonPhotoAttachments.attachments.length > 0"
            :attachments="nonPhotoAttachments.attachments"
            :item-id="location.id"
          />
          <ItemAttachmentsList
            v-if="nonPhotoAttachments.warranty.length > 0"
            :attachments="nonPhotoAttachments.warranty"
            :item-id="location.id"
          />
          <ItemAttachmentsList
            v-if="nonPhotoAttachments.manuals.length > 0"
            :attachments="nonPhotoAttachments.manuals"
            :item-id="location.id"
          />
          <ItemAttachmentsList
            v-if="nonPhotoAttachments.receipts.length > 0"
            :attachments="nonPhotoAttachments.receipts"
            :item-id="location.id"
          />
        </div>
      </BaseCard>
      <p v-if="!showMore" class="mt-3 text-sm text-muted-foreground">{{ $t("purrfect.place_no_extra") }}</p>
    </details>
  </div>
</template>
