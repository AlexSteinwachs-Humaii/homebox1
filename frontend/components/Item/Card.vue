<template>
  <Card
    v-if="purrfect"
    data-inventory-card="item"
    class="relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
  >
    <div v-if="tableRow" class="absolute left-3 top-3 z-20">
      <Checkbox
        class="size-5 bg-accent hover:bg-background-accent"
        :model-value="tableRow.getIsSelected()"
        :aria-label="$t('components.item.view.selectable.select_card')"
        @update:model-value="tableRow.toggleSelected()"
      />
    </div>
    <EntityImage
      class="h-48 w-full"
      :entity-id="item.id"
      :name="item.name"
      :image-id="item.imageId"
      :thumbnail-id="item.thumbnailId"
      :fit="objectContain ? 'contain' : 'cover'"
    />
    <div class="flex flex-col gap-2 p-4">
      <div class="flex items-start gap-2">
        <h2 class="min-w-0 flex-1 text-lg font-semibold leading-snug text-card-foreground">
          <NuxtLink
            data-testid="item-link"
            class="rounded-sm after:absolute after:inset-0 after:content-['']"
            :to="`/item/${item.id}`"
          >
            {{ item.name }}
          </NuxtLink>
        </h2>
        <div class="relative z-10 flex shrink-0 gap-1">
          <TooltipProvider :delay-duration="0">
            <Tooltip v-if="item.insured">
              <TooltipTrigger>
                <MdiShieldCheck class="size-5 text-primary" />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.insured") }}
              </TooltipContent>
            </Tooltip>
            <Tooltip v-if="item.archived">
              <TooltipTrigger>
                <MdiArchive class="size-5 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.archived") }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <NuxtLink
        v-if="location.href"
        data-testid="location-path"
        class="relative z-10 text-sm text-muted-foreground"
        :to="location.href"
      >
        <span class="sr-only">{{ $t("purrfect.location_path") }}: </span>
        <template v-for="(segment, index) in location.segments" :key="`${segment}-${index}`">
          <span v-if="index > 0" aria-hidden="true"> {{ pathSeparator }} </span>
          <span class="break-words">{{ segment }}</span>
        </template>
      </NuxtLink>
      <p v-else-if="location.segments.length" class="text-sm text-muted-foreground" data-testid="location-path">
        <template v-for="(segment, index) in location.segments" :key="`${segment}-${index}`">
          <span v-if="index > 0" aria-hidden="true"> {{ pathSeparator }} </span>
          <span class="break-words">{{ segment }}</span>
        </template>
      </p>
      <div class="relative z-10 mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" hide-icon :ancestors="tag.ancestors" />
        </div>
        <p class="shrink-0 text-sm text-foreground" data-testid="item-meta">
          <span v-if="quantity !== null" data-testid="item-quantity">{{
            $t("purrfect.qty", { count: quantity })
          }}</span>
          <template v-if="price !== null">
            <span v-if="quantity !== null" aria-hidden="true"> · </span>
            <span v-if="quantity !== null" class="sr-only">, </span>
            <span data-testid="item-price">
              <Currency :amount="price" />
            </span>
          </template>
        </p>
      </div>
      <NuxtLink
        v-if="showViewItem"
        :to="`/item/${item.id}`"
        class="relative z-10 mt-1 flex items-center justify-between text-sm font-semibold text-primary"
        data-testid="view-item"
      >
        <span>{{ $t("purrfect.view_item") }}</span>
        <MdiArrowRight class="size-4" aria-hidden="true" />
      </NuxtLink>
    </div>
  </Card>
  <Card v-else class="relative overflow-hidden" data-inventory-card="item">
    <div v-if="tableRow" class="absolute left-1 top-1 z-10">
      <Checkbox
        class="size-5 bg-accent hover:bg-background-accent"
        :model-value="tableRow.getIsSelected()"
        :aria-label="$t('components.item.view.selectable.select_card')"
        @update:model-value="tableRow.toggleSelected()"
      />
    </div>
    <NuxtLink :to="`/item/${item.id}`">
      <div class="relative h-[200px]">
        <EntityImage
          class="absolute inset-0 h-[200px] w-full"
          :entity-id="item.id"
          :name="item.name"
          :image-id="item.imageId"
          :thumbnail-id="item.thumbnailId"
          :fit="objectContain ? 'contain' : 'cover'"
        />
        <div class="absolute inset-x-1 bottom-1">
          <Badge class="text-wrap bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:underline">
            <NuxtLink v-if="item.parent" :to="`/location/${item.parent.id}`">
              {{ location.label || item.parent.name }}
            </NuxtLink>
          </Badge>
        </div>
      </div>
      <div class="col-span-4 flex grow flex-col gap-y-1 p-4 pt-2">
        <h2 class="line-clamp-2 text-ellipsis text-wrap text-lg font-bold">{{ item.name }}</h2>
        <Separator class="mb-1" />
        <TooltipProvider :delay-duration="0">
          <div class="flex items-center gap-2">
            <Tooltip v-if="item.insured">
              <TooltipTrigger>
                <MdiShieldCheck class="size-5 text-primary" />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.insured") }}
              </TooltipContent>
            </Tooltip>
            <Tooltip v-if="item.archived">
              <TooltipTrigger>
                <MdiArchive class="size-5 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.archived") }}
              </TooltipContent>
            </Tooltip>
            <div class="grow" />
            <Tooltip>
              <TooltipTrigger>
                <Badge>
                  {{ item.quantity }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {{ $t("global.quantity") }}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <Markdown class="mb-2 line-clamp-3 text-ellipsis" :source="item.description" />
        <div class="-mr-1 mt-auto flex flex-wrap justify-end gap-2">
          <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
        </div>
      </div>
    </NuxtLink>
  </Card>
</template>

<script setup lang="ts">
  import type { EntityOut, EntitySummary } from "~~/lib/api/types/data-contracts";
  import MdiShieldCheck from "~icons/mdi/shield-check";
  import MdiArchive from "~icons/mdi/archive";
  import MdiArrowRight from "~icons/mdi/arrow-right";
  import { Badge } from "@/components/ui/badge";
  import { Card } from "@/components/ui/card";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { Separator } from "@/components/ui/separator";
  import Markdown from "@/components/global/Markdown.vue";
  import Currency from "@/components/global/Currency.vue";
  import TagChip from "@/components/Tag/Chip.vue";
  import EntityImage from "@/components/Inventory/EntityImage.vue";
  import type { Row } from "@tanstack/vue-table";
  import { Checkbox } from "@/components/ui/checkbox";
  import {
    knownAmount,
    knownCount,
    inventoryLocationPresentation,
    LOCATION_PATH_SEPARATOR,
  } from "~~/lib/inventory-visuals";

  const preferences = useViewPreferences();
  const { theme } = useTheme();

  const props = defineProps({
    item: {
      type: Object as () => EntityOut | EntitySummary,
      required: true,
    },
    locationFlatTree: {
      type: Array as () => FlatTreeItem[],
      required: false,
      default: () => [],
    },
    tableRow: {
      type: Object as () => Row<EntitySummary>,
      required: false,
      default: () => null,
    },
  });

  const route = useRoute();
  const purrfect = computed(() => theme.value === "purrfect-home");
  const showViewItem = computed(() => purrfect.value && route.path === "/items");
  const pathSeparator = LOCATION_PATH_SEPARATOR;
  const objectContain = computed(() => !preferences.value.legacyImageFit);

  const itemTags = computed(() => {
    return useTagStore().withAncestors(props.item.tags ?? []);
  });

  const location = computed(() => {
    const detailed = props.item as EntityOut;
    return inventoryLocationPresentation({
      treeString: props.locationFlatTree.find(entry => entry.id === props.item.parent?.id)?.treeString,
      parent: props.item.parent,
      location: detailed.location,
    });
  });

  const quantity = computed(() => knownCount(props.item.quantity));
  const price = computed(() => knownAmount(props.item.purchasePrice));
</script>

<style lang="css"></style>
