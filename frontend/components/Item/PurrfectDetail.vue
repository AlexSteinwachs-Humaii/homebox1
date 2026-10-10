<script setup lang="ts">
  import type { EntityOut, EntitySummary, ItemAttachment } from "~~/lib/api/types/data-contracts";
  import type { Details } from "~~/components/global/DetailsSection/types";
  import type { ItemCrumb } from "~~/lib/item-detail-presentation";
  import MdiMinus from "~icons/mdi/minus";
  import MdiPlus from "~icons/mdi/plus";
  import MdiDelete from "~icons/mdi/delete";
  import MdiPlusBoxMultipleOutline from "~icons/mdi/plus-box-multiple-outline";
  import MdiContentSaveEdit from "~icons/mdi/content-save-edit";
  import MdiDotsVertical from "~icons/mdi/dots-vertical";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Button } from "@/components/ui/button";
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";
  import TagChip from "~/components/Tag/Chip.vue";
  import DateTime from "~/components/global/DateTime.vue";
  import LabelMaker from "~/components/global/LabelMaker.vue";
  import Markdown from "~/components/global/Markdown.vue";
  import Currency from "@/components/global/Currency.vue";
  import BaseCard from "@/components/Base/Card.vue";
  import CopyText from "@/components/global/CopyText.vue";
  import DetailsSection from "~/components/global/DetailsSection/DetailsSection.vue";
  import ItemAttachmentsList from "~/components/Item/AttachmentsList.vue";
  import ItemViewSelectable from "~/components/Item/View/Selectable.vue";
  import EntityImage from "~/components/Inventory/EntityImage.vue";

  type Photo = {
    thumbnailSrc?: string;
    thumbnailId?: string;
    originalSrc: string;
    attachmentId: string;
    originalType?: string;
  };

  type FilteredAttachments = {
    attachments: ItemAttachment[];
    warranty: ItemAttachment[];
    manuals: ItemAttachment[];
    receipts: ItemAttachment[];
  };

  const props = defineProps<{
    item: EntityOut;
    crumbs: ItemCrumb[];
    locationSegments: Array<{ id: string; name: string }>;
    openLocationHref: string | null;
    photos: Photo[];
    featuredPhoto: Photo | null;
    assetLabel: string | null;
    description: string | null;
    purchaseDate: Date | string | null;
    createdDate: Date | string | null;
    updatedDate: Date | string | null;
    detailRows: Array<{ key: string; label: string; value: string | null }>;
    attachments: FilteredAttachments;
    extraDetails: Details;
    warrantyDetails: Details;
    soldDetails: Details;
    showWarranty: boolean;
    showSold: boolean;
    children: EntitySummary[];
    hasNested: boolean;
    showEmpty: boolean;
    currentUrl: string;
  }>();

  const emit = defineEmits<{
    adjust: [amount: number];
    openPhoto: [photo: Photo];
    duplicate: [event: MouseEvent];
    delete: [];
    saveTemplate: [];
    createSubitem: [];
    refreshChildren: [];
    openLocation: [];
    "update:showEmpty": [value: boolean];
  }>();

  const itemTags = computed(() => useTagStore().withAncestors(props.item.tags || []));

  const hasFiles = computed(
    () =>
      props.attachments.attachments.length > 0 ||
      props.attachments.warranty.length > 0 ||
      props.attachments.manuals.length > 0 ||
      props.attachments.receipts.length > 0
  );

  function onShowEmpty(value: boolean | undefined) {
    emit("update:showEmpty", Boolean(value));
  }

  function onOpenLocation(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    emit("openLocation");
  }
</script>

<template>
  <div data-testid="purrfect-item" data-item-layout="purrfect" data-state="ready" :data-item-id="item.id">
    <div v-if="hasNested" class="mb-4">
      <NuxtLink
        :to="`/item/${item.id}`"
        data-testid="item-back"
        class="text-sm font-medium text-primary hover:underline"
      >
        {{ $t("purrfect.item_back") }}
      </NuxtLink>
      <slot name="nested" />
    </div>

    <template v-else>
      <nav v-if="crumbs.length > 0" data-testid="item-breadcrumb" :aria-label="$t('global.navigate')">
        <ol class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li v-for="(crumb, index) in crumbs" :key="`${crumb.kind}-${crumb.id}`" class="flex items-center gap-1">
            <NuxtLink
              v-if="crumb.href"
              :to="crumb.href"
              class="rounded-sm hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              :class="crumb.kind === 'location' ? 'font-medium text-primary' : ''"
              :data-crumb-id="crumb.id"
              :data-crumb-kind="crumb.kind"
            >
              {{ crumb.name }}
            </NuxtLink>
            <span v-else :data-crumb-id="crumb.id" :data-crumb-kind="crumb.kind">{{ crumb.name }}</span>
            <span v-if="index < crumbs.length - 1" aria-hidden="true">›</span>
          </li>
        </ol>
      </nav>

      <div class="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h1 data-testid="item-name" class="text-wrap text-4xl font-semibold tracking-tight">{{ item.name }}</h1>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
            <span v-if="assetLabel" data-testid="item-asset" class="text-sm text-muted-foreground">{{
              assetLabel
            }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button as-child variant="outline" class="rounded-full bg-card">
            <NuxtLink :to="`/item/${item.id}/edit`" data-testid="item-edit">{{ $t("global.edit") }}</NuxtLink>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="rounded-full bg-card"
                data-testid="item-actions"
                :aria-label="$t('global.more_actions')"
              >
                <MdiDotsVertical class="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem data-testid="item-action-duplicate" @click="emit('duplicate', $event)">
                <MdiPlusBoxMultipleOutline class="mr-2 size-4" />
                {{ $t("global.duplicate") }}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="item-action-subitem" @click="emit('createSubitem')">
                <MdiPlus class="mr-2 size-4" />
                {{ $t("global.create_subitem") }}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="item-action-template" @click="emit('saveTemplate')">
                <MdiContentSaveEdit class="mr-2 size-4" />
                {{ $t("components.template.save_as_template") }}
              </DropdownMenuItem>
              <DropdownMenuItem as-child data-testid="item-action-maintenance">
                <NuxtLink :to="`/item/${item.id}/maintenance`">
                  {{ $t("global.maintenance") }}
                </NuxtLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive focus:text-destructive"
                data-testid="item-action-delete"
                @click="emit('delete')"
              >
                <MdiDelete class="mr-2 size-4" />
                {{ $t("global.delete") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div class="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <div
            class="relative h-80 overflow-hidden rounded-3xl bg-accent"
            data-testid="item-photo"
            :data-photo-count="photos.length"
          >
            <button
              v-if="featuredPhoto"
              type="button"
              class="absolute inset-0"
              data-testid="item-open-photo"
              :aria-label="$t('purrfect.item_open_photo')"
              @click="emit('openPhoto', featuredPhoto)"
            >
              <EntityImage
                class="size-full"
                :entity-id="item.id"
                :name="item.name"
                :attachment-id="featuredPhoto.attachmentId"
                :attachment-thumbnail-id="featuredPhoto.thumbnailId"
                prefer="original"
                fit="contain"
              />
            </button>
            <EntityImage
              v-else
              class="size-full"
              :entity-id="item.id"
              :name="item.name"
              :image-id="item.imageId"
              :thumbnail-id="item.thumbnailId"
              prefer="original"
              fit="contain"
            />
          </div>
          <div v-if="photos.length > 1" data-testid="item-photo-strip" class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="photo in photos"
              :key="photo.attachmentId"
              type="button"
              class="size-16 overflow-hidden rounded-xl border border-border bg-accent"
              :aria-label="$t('purrfect.item_open_photo')"
              @click="emit('openPhoto', photo)"
            >
              <img class="size-full object-cover" :src="photo.thumbnailSrc" alt="" />
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div
            data-testid="item-description"
            class="rounded-3xl border border-border/70 bg-card p-5 text-sm leading-relaxed"
            :data-empty="description ? 'false' : 'true'"
          >
            <Markdown v-if="description" :source="description" />
            <p v-else class="text-muted-foreground">{{ $t("purrfect.item_no_description") }}</p>
          </div>

          <div class="rounded-3xl bg-accent/70 p-5" data-testid="item-location-panel">
            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {{ $t("items.location") }}
            </p>
            <p v-if="locationSegments.length > 0" data-testid="item-location" class="mt-2 text-lg font-semibold">
              <template v-for="(segment, index) in locationSegments" :key="segment.id">
                <span v-if="index > 0" aria-hidden="true"> → </span>
                <span :data-location-id="segment.id">{{ segment.name }}</span>
              </template>
            </p>
            <p v-else data-testid="item-location" data-empty="true" class="mt-2 text-sm text-muted-foreground">
              {{ $t("purrfect.item_location_unavailable") }}
            </p>
            <NuxtLink
              v-if="openLocationHref"
              :to="openLocationHref"
              data-testid="open-location"
              class="mt-3 inline-flex rounded-sm text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              @click="onOpenLocation"
            >
              {{ $t("purrfect.item_open_location") }}
              <span aria-hidden="true"> →</span>
            </NuxtLink>
          </div>

          <dl class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-accent/40 p-4">
              <dt class="text-xs text-muted-foreground">{{ $t("items.quantity") }}</dt>
              <dd class="mt-1 flex items-center gap-2">
                <span data-testid="item-quantity" class="text-2xl font-semibold">{{ item.quantity }}</span>
                <span class="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    class="size-8 rounded-full bg-card"
                    data-testid="decrease-quantity"
                    :aria-label="$t('purrfect.item_decrease_quantity')"
                    @click="emit('adjust', -1)"
                  >
                    <MdiMinus class="size-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    class="size-8 rounded-full bg-card"
                    data-testid="increase-quantity"
                    :aria-label="$t('purrfect.item_increase_quantity')"
                    @click="emit('adjust', 1)"
                  >
                    <MdiPlus class="size-3" />
                  </Button>
                </span>
              </dd>
            </div>
            <div class="rounded-2xl bg-accent/40 p-4">
              <dt class="text-xs text-muted-foreground">{{ $t("items.purchase_price") }}</dt>
              <dd data-testid="item-price" class="mt-1 text-2xl font-semibold">
                <Currency :amount="item.purchasePrice" />
              </dd>
            </div>
            <div class="rounded-2xl bg-accent/40 p-4">
              <dt class="text-xs text-muted-foreground">{{ $t("items.insured") }}</dt>
              <dd data-testid="item-insured" class="mt-1 text-2xl font-semibold">
                {{ item.insured ? $t("global.yes") : $t("global.no") }}
              </dd>
            </div>
            <div class="rounded-2xl bg-accent/40 p-4">
              <dt class="text-xs text-muted-foreground">{{ $t("items.purchase_date") }}</dt>
              <dd data-testid="item-purchased" class="mt-1 text-2xl font-semibold">
                <DateTime v-if="purchaseDate" :date="purchaseDate" format="long" datetime-type="date" />
                <span v-else class="text-base font-medium text-muted-foreground">{{
                  $t("purrfect.item_not_recorded")
                }}</span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div class="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section class="rounded-3xl border border-border/70 bg-card p-5" data-testid="item-details">
          <h2 class="text-lg font-semibold">{{ $t("items.details") }}</h2>
          <dl class="mt-3 divide-y divide-border/70">
            <div v-for="row in detailRows" :key="row.key" class="grid grid-cols-2 gap-3 py-3 text-sm">
              <dt class="text-muted-foreground">{{ row.label }}</dt>
              <dd class="font-semibold" :data-detail="row.key" :data-empty="row.value ? 'false' : 'true'">
                {{ row.value ?? $t("purrfect.item_not_recorded") }}
              </dd>
            </div>
          </dl>
        </section>

        <section
          class="rounded-3xl border border-border/70 bg-card p-5"
          data-testid="item-attachments"
          :data-empty="hasFiles ? 'false' : 'true'"
        >
          <h2 class="text-lg font-semibold">{{ $t("items.attachments") }}</h2>
          <div v-if="hasFiles" class="mt-4 space-y-4">
            <div v-if="attachments.attachments.length > 0">
              <h3 class="mb-2 text-sm font-medium">{{ $t("items.attachments") }}</h3>
              <ItemAttachmentsList :attachments="attachments.attachments" :item-id="item.id" />
            </div>
            <div v-if="attachments.manuals.length > 0">
              <h3 class="mb-2 text-sm font-medium">{{ $t("items.manuals") }}</h3>
              <ItemAttachmentsList :attachments="attachments.manuals" :item-id="item.id" />
            </div>
            <div v-if="attachments.warranty.length > 0">
              <h3 class="mb-2 text-sm font-medium">{{ $t("items.warranty") }}</h3>
              <ItemAttachmentsList :attachments="attachments.warranty" :item-id="item.id" />
            </div>
            <div v-if="attachments.receipts.length > 0">
              <h3 class="mb-2 text-sm font-medium">{{ $t("items.receipts") }}</h3>
              <ItemAttachmentsList :attachments="attachments.receipts" :item-id="item.id" />
            </div>
          </div>
          <p v-else class="mt-3 text-sm text-muted-foreground">{{ $t("purrfect.item_no_attachments") }}</p>
        </section>
      </div>

      <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
        <p data-testid="item-timestamps" class="text-sm text-muted-foreground">
          <template v-if="createdDate">
            {{ $t("items.created_at") }}
            <DateTime :date="createdDate" format="long" datetime-type="date" />
          </template>
          <template v-if="createdDate && updatedDate"> · </template>
          <template v-if="updatedDate">
            {{ $t("items.updated_at") }}
            <DateTime :date="updatedDate" format="long" datetime-type="date" />
          </template>
          <template v-if="!createdDate && !updatedDate">{{ $t("purrfect.item_not_recorded") }}</template>
        </p>
        <p class="rounded-full bg-accent px-3 py-1 text-sm text-accent-foreground" data-testid="purrfect-theme-label">
          {{ $t("purrfect.optional_theme") }}
        </p>
      </div>

      <section data-testid="item-more" class="mt-8 space-y-6 border-t border-border/60 pt-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">{{ $t("purrfect.item_more") }}</h2>
          <div class="flex items-center gap-3">
            <CopyText :text="currentUrl" :icon-size="16" />
            <Label class="flex cursor-pointer items-center gap-2">
              <Switch :model-value="showEmpty" @update:model-value="onShowEmpty" />
              {{ $t("items.show_empty") }}
            </Label>
          </div>
        </div>

        <div data-testid="item-labels">
          <p class="mb-2 text-sm font-medium">{{ $t("purrfect.item_labels") }}</p>
          <LabelMaker v-if="assetLabel" :id="item.assetId" type="asset" />
          <LabelMaker v-else :id="item.id" type="item" />
        </div>

        <NuxtLink
          :to="`/item/${item.id}/maintenance`"
          data-testid="item-maintenance"
          class="inline-flex text-sm font-medium text-primary hover:underline"
        >
          {{ $t("global.maintenance") }}
        </NuxtLink>

        <BaseCard v-if="extraDetails.length > 0" collapsable>
          <template #title>{{ $t("items.custom_fields") }}</template>
          <DetailsSection :details="extraDetails" />
        </BaseCard>

        <BaseCard v-if="showWarranty" collapsable>
          <template #title>{{ $t("items.warranty_details") }}</template>
          <DetailsSection :details="warrantyDetails" />
        </BaseCard>

        <BaseCard v-if="showSold" collapsable>
          <template #title>{{ $t("items.sold_details") }}</template>
          <DetailsSection :details="soldDetails" />
        </BaseCard>

        <ItemViewSelectable v-if="children.length > 0" :items="children" @refresh="emit('refreshChildren')" />
      </section>
    </template>
  </div>
</template>
