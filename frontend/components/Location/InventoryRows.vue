<script setup lang="ts">
  import type { BrowseRecord, ShelfGroup } from "~~/lib/location-browse";
  import { formatQuantityValue } from "~~/lib/location-browse";
  import type { TagSummary } from "~~/lib/api/types/data-contracts";
  import EntityImage from "~/components/Inventory/EntityImage.vue";
  import TagChip from "~/components/Tag/Chip.vue";
  import Currency from "~/components/global/Currency.vue";

  const props = defineProps<{
    complete: boolean;
    groups: ShelfGroup[];
    partialItems: BrowseRecord[];
  }>();

  function asTag(tag: { id: string; name: string }): TagSummary {
    return {
      id: tag.id,
      name: tag.name,
      color: "",
      icon: "",
      description: "",
      createdAt: "",
      updatedAt: "",
    };
  }

  const rows = computed(() => {
    if (props.complete) {
      return props.groups;
    }
    return [
      {
        id: "partial",
        label: "",
        items: props.partialItems.map(item => ({ ...item, placeLabel: "" })),
      },
    ];
  });
</script>

<template>
  <div :data-groups="complete ? 'complete' : 'incomplete'" data-testid="location-inventory">
    <section
      v-for="group in rows"
      :key="group.id"
      :data-testid="complete ? 'location-shelf-group' : 'location-partial-list'"
      :data-shelf-id="complete ? group.id : undefined"
    >
      <h3 v-if="complete" class="mb-2 text-sm font-semibold text-foreground" data-testid="location-shelf">
        {{ group.label || $t("purrfect.place_shelf_unknown") }}
      </h3>
      <div class="overflow-hidden rounded-2xl border border-border bg-card">
        <article
          v-for="item in group.items"
          :key="item.id"
          class="flex items-center gap-4 border-b border-border/70 px-4 py-3 last:border-b-0"
          data-testid="location-item-row"
          :data-item-id="item.id"
        >
          <EntityImage
            class="size-12 shrink-0 rounded-xl [&_[data-image-fallback]_span]:sr-only [&_svg]:size-5"
            :entity-id="item.id"
            :name="item.name"
            :image-id="item.imageId"
            :thumbnail-id="item.thumbnailId"
            fit="cover"
          />
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/item/${item.id}`"
              class="break-words font-semibold text-foreground hover:underline"
              data-testid="location-item-link"
            >
              {{ item.name }}
            </NuxtLink>
            <p v-if="item.placeLabel || item.quantity != null" class="mt-0.5 text-xs text-muted-foreground">
              <span v-if="item.placeLabel" data-testid="location-item-place">{{ item.placeLabel }}</span>
              <template v-if="item.quantity != null">
                <span v-if="item.placeLabel" aria-hidden="true"> · </span>
                <span data-testid="location-item-quantity">{{
                  $t("purrfect.qty", { count: formatQuantityValue(item.quantity) })
                }}</span>
              </template>
            </p>
          </div>
          <div
            v-if="item.tags.length > 0"
            class="hidden max-w-[40%] flex-wrap justify-end gap-1.5 md:flex"
            data-testid="location-item-tags"
          >
            <TagChip v-for="tag in item.tags" :key="tag.id" :tag="asTag(tag)" size="sm" hide-icon />
          </div>
          <p
            v-if="item.purchasePrice != null"
            class="shrink-0 text-sm text-foreground"
            data-testid="location-item-price"
          >
            <Currency :amount="item.purchasePrice" />
          </p>
        </article>
      </div>
    </section>
  </div>
</template>
