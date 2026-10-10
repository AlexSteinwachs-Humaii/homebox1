<script setup lang="ts">
  import { computed } from "vue";
  import type { EntitySummary } from "~/lib/api/types/data-contracts";
  import TagChip from "@/components/Tag/Chip.vue";
  import Badge from "~/components/ui/badge/Badge.vue";
  import EntityImage from "@/components/Inventory/EntityImage.vue";

  const props = defineProps<{
    item: EntitySummary;
  }>();

  const itemTags = computed(() => {
    return useTagStore().withAncestors(props.item.tags);
  });
</script>

<template>
  <div class="flex items-start gap-3">
    <div class="size-32 shrink-0 overflow-hidden rounded-lg">
      <EntityImage
        class="size-32"
        :entity-id="item.id"
        :name="item.name"
        :image-id="item.imageId"
        :thumbnail-id="item.thumbnailId"
        fit="cover"
      />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <h2 class="truncate text-xl font-bold">{{ item.name }}</h2>
      <Badge class="w-min text-nowrap bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:underline">
        <NuxtLink v-if="item.location" :to="`/location/${item.location.id}`">
          {{ item.location.name }}
        </NuxtLink>
      </Badge>
      <div class="flex flex-wrap gap-2">
        <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
      </div>
      <p class="whitespace-pre-line break-words text-sm text-muted-foreground">
        {{ item.description || $t("components.item.no_description") }}
      </p>
    </div>
  </div>
</template>
