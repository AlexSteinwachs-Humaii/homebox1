<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { toast } from "@/components/ui/sonner";
  import type { AnyDetail, Detail, Details } from "~~/components/global/DetailsSection/types";
  import { filterZeroValues } from "~~/components/global/DetailsSection/types";
  import type { EntityOut, EntityPath, EntitySummary, ItemAttachment } from "~~/lib/api/types/data-contracts";
  import MdiPackageVariant from "~icons/mdi/package-variant";
  import MdiPlus from "~icons/mdi/plus";
  import MdiMinus from "~icons/mdi/minus";
  import MdiDelete from "~icons/mdi/delete";
  import MdiPlusBoxMultipleOutline from "~icons/mdi/plus-box-multiple-outline";
  import MdiContentSaveEdit from "~icons/mdi/content-save-edit";
  import MdiDotsVertical from "~icons/mdi/dots-vertical";
  import { Separator } from "@/components/ui/separator";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
  } from "@/components/ui/breadcrumb";
  import { Button, ButtonGroup } from "@/components/ui/button";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { Label } from "@/components/ui/label";
  import { Switch } from "@/components/ui/switch";
  import { Card } from "@/components/ui/card";
  import { DialogID } from "~/components/ui/dialog-provider/utils";
  import BaseContainer from "@/components/Base/Container.vue";
  import ItemImageDialog from "~/components/Item/ImageDialog.vue";
  import ItemDuplicateSettings from "~/components/Item/DuplicateSettings.vue";
  import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
  import TagChip from "~/components/Tag/Chip.vue";
  import DateTime from "~/components/global/DateTime.vue";
  import LabelMaker from "~/components/global/LabelMaker.vue";
  import Markdown from "~/components/global/Markdown.vue";
  import BaseCard from "@/components/Base/Card.vue";
  import CopyText from "@/components/global/CopyText.vue";
  import DetailsSection from "~/components/global/DetailsSection/DetailsSection.vue";
  import ItemAttachmentsList from "~/components/Item/AttachmentsList.vue";
  import ItemViewSelectable from "~/components/Item/View/Selectable.vue";
  import ItemPurrfectDetail from "~/components/Item/PurrfectDetail.vue";
  import { PURRFECT_DESKTOP_MEDIA_QUERY, parseInventoryId } from "~~/lib/inventory-context";
  import {
    createItemLoadGate,
    presentItemLocation,
    recordedAssetId,
    recordedDate,
    recordedText,
  } from "~~/lib/item-detail-presentation";
  import { useLocationStore } from "~~/stores/locations";

  const { t } = useI18n();

  const { openDialog, closeDialog } = useDialog();

  definePageMeta({
    middleware: ["auth"],
  });

  const route = useRoute();

  function client() {
    return useUserApi();
  }

  const itemId = computed<string>(() => route.params.id as string);
  const preferences = useViewPreferences();
  const { theme } = useTheme();
  const isDesktop = useMediaQuery(PURRFECT_DESKTOP_MEDIA_QUERY);
  const { selectedId, selectedCollection } = useCollections();
  const collectionId = computed(() => selectedId.value ?? preferences.value.collectionId ?? null);
  const purrfectDesktop = computed(() => theme.value === "purrfect-home" && isDesktop.value);
  const locationStore = useLocationStore();

  const temporaryDuplicateSettings = ref<DuplicateSettings>({
    copyMaintenance: preferences.value.duplicateSettings.copyMaintenance,
    copyAttachments: preferences.value.duplicateSettings.copyAttachments,
    copyCustomFields: preferences.value.duplicateSettings.copyCustomFields,
    copyPrefixOverride: preferences.value.duplicateSettings.copyPrefixOverride,
  });

  const hasNested = computed<boolean>(() => {
    return route.fullPath.split("/").at(-1) !== itemId.value;
  });

  const item = ref<EntityOut | null>(null);
  const itemPath = ref<EntityPath[]>([]);
  const items = ref<EntitySummary[]>([]);
  const loadState = ref<"loading" | "ready" | "unavailable">("loading");
  const loadGate = createItemLoadGate();

  function clearVisibleItem() {
    item.value = null;
    itemPath.value = [];
    items.value = [];
    loadState.value = "loading";
  }

  async function loadItem(token: ReturnType<typeof loadGate.begin>) {
    const api = client();
    let data: EntityOut | null = null;
    let error = false;
    try {
      const resp = await api.items.get(token.itemId);
      data = resp.data ?? null;
      error = Boolean(resp.error) || !data || data.id !== token.itemId;
    } catch {
      error = true;
    }

    if (!loadGate.accepts(token)) {
      return;
    }

    if (error || !data) {
      item.value = null;
      itemPath.value = [];
      items.value = [];
      loadState.value = "unavailable";
      if (!purrfectDesktop.value) {
        toast.error(t("items.toast.failed_load_item"));
        await navigateTo("/home");
      }
      return;
    }

    item.value = data;
    loadState.value = "ready";

    const [pathResp, childrenResp] = await Promise.all([
      api.items.fullpath(token.itemId),
      api.items.getAll({ parentIds: [token.itemId] }),
    ]);
    if (!loadGate.accepts(token)) {
      return;
    }

    itemPath.value = pathResp.error || !pathResp.data ? [] : pathResp.data;
    if (childrenResp.error) {
      items.value = [];
      toast.error(t("items.toast.failed_load_items"));
      return;
    }
    items.value = childrenResp.data?.items ?? [];
  }

  function refresh() {
    const token = loadGate.begin(itemId.value, collectionId.value);
    clearVisibleItem();
    return loadItem(token);
  }

  watch(
    [itemId, collectionId],
    () => {
      const token = loadGate.begin(itemId.value, collectionId.value);
      clearVisibleItem();
      void loadItem(token);
    },
    { immediate: true }
  );

  watch(
    () => route.fullPath,
    (path, previous) => {
      if (previous?.endsWith("edit") && !path.endsWith("edit")) {
        void refresh();
      }
    }
  );

  watch(
    collectionId,
    id => {
      locationStore.prepareForCollection(id);
      void locationStore.ensureLocationsFetched();
      if (locationStore.tree === null) {
        void locationStore.refreshTree();
      }
    },
    { immediate: true }
  );

  const shownItem = computed(() => {
    const current = item.value;
    if (loadState.value !== "ready" || !current || current.id !== itemId.value) {
      return null;
    }
    return current;
  });

  const locationIds = computed(() => {
    if (locationStore.Locations === null) {
      return null;
    }
    return new Set(locationStore.Locations.map(location => location.id));
  });

  const locationPresentation = computed(() => {
    const current = shownItem.value;
    if (!current) {
      return presentItemLocation({
        itemId: itemId.value,
        locationIds: locationIds.value,
      });
    }
    return presentItemLocation({
      itemId: current.id,
      collectionName: selectedCollection.value?.name,
      collectionId: collectionId.value,
      path: itemPath.value,
      parent: current.parent,
      location: current.location,
      locationIds: locationIds.value,
    });
  });

  const assetLabel = computed(() => {
    const id = recordedAssetId(shownItem.value?.assetId);
    return id ? t("purrfect.item_asset", { id }) : null;
  });

  const purchaseDate = computed(() => recordedDate(shownItem.value?.purchaseDate));
  const descriptionText = computed(() => recordedText(shownItem.value?.description));
  const createdDate = computed(() => recordedDate(shownItem.value?.createdAt));
  const updatedDate = computed(() => recordedDate(shownItem.value?.updatedAt));

  const detailRows = computed(() => {
    const current = shownItem.value;
    if (!current) {
      return [];
    }
    return [
      { key: "manufacturer", label: t("items.manufacturer"), value: recordedText(current.manufacturer) },
      { key: "model", label: t("items.model_number"), value: recordedText(current.modelNumber) },
      { key: "serial", label: t("items.serial_number"), value: recordedText(current.serialNumber) },
      { key: "purchased-from", label: t("items.purchased_from"), value: recordedText(current.purchaseFrom) },
    ];
  });

  const extraDetails = computed<Details>(() => {
    const current = shownItem.value;
    if (!current) {
      return [];
    }
    const details: Details = [];
    if (current.archived || preferences.value.showEmpty) {
      details.push({
        name: "items.archived",
        text: current.archived ? t("global.yes") : t("global.no"),
      });
    }
    const notes = recordedText(current.notes);
    if (notes || preferences.value.showEmpty) {
      details.push({
        name: "items.notes",
        type: "markdown",
        text: notes ?? "",
      });
    }
    for (const field of current.fields ?? []) {
      const text = recordedText(field.textValue);
      if (!text && !preferences.value.showEmpty) {
        continue;
      }
      const url = text ? maybeUrl(text) : null;
      if (url?.isUrl) {
        details.push({ type: "link", name: field.name, text: url.text, href: url.url });
      } else {
        details.push({ name: field.name, text: text ?? "" });
      }
    }
    return details;
  });

  async function adjustQuantity(amount: number) {
    if (!item.value) {
      return;
    }

    const newQuantity = item.value.quantity + amount;
    if (newQuantity < 0) {
      toast.error(t("items.toast.quantity_cannot_negative"));
      return;
    }

    const id = item.value.id;
    const collection = collectionId.value;
    const resp = await client().items.patch(id, {
      id,
      quantity: newQuantity,
    });

    if (itemId.value !== id || collectionId.value !== collection || !item.value) {
      return;
    }

    if (resp.error) {
      toast.error(t("items.toast.failed_adjust_quantity"));
      return;
    }

    if (resp.data && resp.data.id === id) {
      item.value = resp.data;
    }
  }

  type FilteredAttachments = {
    attachments: ItemAttachment[];
    warranty: ItemAttachment[];
    manuals: ItemAttachment[];
    receipts: ItemAttachment[];
  };

  type Photo = {
    thumbnailSrc?: string;
    thumbnailId?: string;
    originalSrc: string;
    attachmentId: string;
    originalType?: string;
  };

  const featuredIndex = ref(0);
  watch(itemId, () => {
    featuredIndex.value = 0;
  });

  const itemTags = computed(() => {
    return useTagStore().withAncestors(item.value?.tags || []);
  });

  const photos = computed<Photo[]>(() => {
    if (!item.value) {
      return [];
    }
    return (
      (item.value.attachments ?? []).reduce((acc, cur) => {
        if (cur.type === "photo") {
          const photo: Photo = {
            originalSrc: client().authURL(`/entities/${item.value!.id}/attachments/${cur.id}`),
            originalType: cur.mimeType,
            attachmentId: cur.id,
            thumbnailId: cur.thumbnail?.id,
          };
          if (cur.thumbnail?.id) {
            photo.thumbnailSrc = client().authURL(`/entities/${item.value!.id}/attachments/${cur.thumbnail.id}`);
          } else {
            photo.thumbnailSrc = photo.originalSrc; // fallback to itself if no thumbnail
          }
          acc.push(photo);
        }
        return acc;
      }, [] as Photo[]) || []
    );
  });

  const displayPhotos = computed<Photo[]>(() => {
    const current = item.value;
    const listed = photos.value;
    if (!current) {
      return [];
    }
    const imageId = parseInventoryId(current.imageId);
    if (!imageId || listed.some(photo => photo.attachmentId === imageId)) {
      return listed;
    }
    const thumbnailId = parseInventoryId(current.thumbnailId) ?? undefined;
    const originalSrc = client().authURL(`/entities/${current.id}/attachments/${imageId}`);
    return [
      {
        attachmentId: imageId,
        thumbnailId,
        originalSrc,
        thumbnailSrc: thumbnailId
          ? client().authURL(`/entities/${current.id}/attachments/${thumbnailId}`)
          : originalSrc,
      },
      ...listed,
    ];
  });

  const attachments = computed<FilteredAttachments>(() => {
    if (!item.value) {
      return {
        attachments: [],
        manuals: [],
        warranty: [],
        receipts: [],
      };
    }

    return item.value.attachments.reduce(
      (acc, attachment) => {
        if (attachment.type === "photo") {
          return acc;
        }
        if (attachment.type === "warranty") {
          acc.warranty.push(attachment);
        } else if (attachment.type === "manual") {
          acc.manuals.push(attachment);
        } else if (attachment.type === "receipt") {
          acc.receipts.push(attachment);
        } else {
          acc.attachments.push(attachment);
        }
        return acc;
      },
      {
        attachments: [] as ItemAttachment[],
        warranty: [] as ItemAttachment[],
        manuals: [] as ItemAttachment[],
        receipts: [] as ItemAttachment[],
      }
    );
  });

  const assetID = computed<Details>(() => {
    if (!item.value) {
      return [];
    }

    if (item.value?.assetId === "000-000") {
      return [];
    }

    return [
      {
        name: "items.asset_id",
        text: item.value?.assetId,
      },
    ];
  });

  const itemDetails = computed<Details>(() => {
    if (!item.value) {
      return [];
    }

    const ret: Details = [
      {
        name: "items.quantity",
        text: item.value?.quantity,
        slot: "quantity",
      },
      {
        name: "items.serial_number",
        text: item.value?.serialNumber,
        copyable: true,
      },
      {
        name: "items.model_number",
        text: item.value?.modelNumber,
        copyable: true,
      },
      {
        name: "items.manufacturer",
        text: item.value?.manufacturer,
        copyable: true,
      },
      {
        name: "items.insured",
        text: item.value?.insured ? "Yes" : "No",
      },
      {
        name: "items.archived",
        text: item.value?.archived ? "Yes" : "No",
      },
      {
        name: "items.notes",
        type: "markdown",
        text: item.value?.notes,
      },
      ...assetID.value,
      ...item.value.fields.map(field => {
        /**
         * Support Special URL Syntax
         */
        const url = maybeUrl(field.textValue);
        if (url.isUrl) {
          return {
            type: "link",
            name: field.name,
            text: url.text,
            href: url.url,
          } as AnyDetail;
        }

        return {
          name: field.name,
          text: field.textValue,
        };
      }),
    ];

    if (!preferences.value.showEmpty) {
      return filterZeroValues(ret);
    }

    return ret;
  });

  const showAttachments = computed(() => {
    if (preferences.value?.showEmpty) {
      return true;
    }

    return (
      attachments.value.attachments.length > 0 ||
      attachments.value.warranty.length > 0 ||
      attachments.value.manuals.length > 0 ||
      attachments.value.receipts.length > 0
    );
  });

  const attachmentDetails = computed(() => {
    const details: Detail[] = [];

    const push = (name: string, slot: string) => {
      details.push({
        name,
        text: "",
        slot,
      });
    };

    if (attachments.value.attachments.length > 0) {
      push("items.attachments", "attachments");
    }

    if (attachments.value.warranty.length > 0) {
      push("items.warranty", "warranty");
    }

    if (attachments.value.manuals.length > 0) {
      push("items.manuals", "manuals");
    }

    if (attachments.value.receipts.length > 0) {
      push("items.receipts", "receipts");
    }

    return details;
  });

  const showWarranty = computed(() => {
    if (preferences.value.showEmpty) {
      return true;
    }
    return item.value?.lifetimeWarranty || validDate(item.value?.warrantyExpires);
  });

  const warrantyDetails = computed(() => {
    const details: Details = [
      {
        name: "items.lifetime_warranty",
        text: item.value?.lifetimeWarranty ? "Yes" : "No",
      },
    ];

    if (item.value?.lifetimeWarranty) {
      details.push({
        name: "items.warranty_expires",
        text: "N/A",
      });
    } else {
      details.push({
        name: "items.warranty_expires",
        text: item.value?.warrantyExpires || "",
        type: "date",
        date: true,
      });
    }

    details.push({
      name: "items.warranty_details",
      type: "markdown",
      text: item.value?.warrantyDetails || "",
    });

    if (!preferences.value.showEmpty) {
      return filterZeroValues(details);
    }

    return details;
  });

  const showPurchase = computed(() => {
    if (preferences.value.showEmpty) {
      return true;
    }
    return item.value?.purchaseFrom || item.value?.purchasePrice !== 0 || validDate(item.value?.purchaseDate);
  });

  const purchaseDetails = computed<Details>(() => {
    const v: Details = [
      {
        name: "items.purchased_from",
        text: item.value?.purchaseFrom || "",
      },
      {
        name: "items.purchase_price",
        text: String(item.value?.purchasePrice) || "",
        type: "currency",
      },
      {
        name: "items.purchase_date",
        text: item.value?.purchaseDate || "",
        type: "date",
        date: true,
      },
    ];

    if (!preferences.value.showEmpty) {
      return filterZeroValues(v);
    }

    return v;
  });

  const showSold = computed(() => {
    if (preferences.value.showEmpty) {
      return true;
    }
    return item.value?.soldTo || item.value?.soldPrice !== 0 || validDate(item.value?.soldDate);
  });

  const soldDetails = computed<Details>(() => {
    const v: Details = [
      {
        name: "items.sold_to",
        text: item.value?.soldTo || "",
      },
      {
        name: "items.sold_price",
        text: String(item.value?.soldPrice) || "",
        type: "currency",
      },
      {
        name: "items.sold_at",
        text: item.value?.soldDate || "",
        type: "date",
        date: true,
      },
    ];

    if (!preferences.value.showEmpty) {
      return filterZeroValues(v);
    }

    return v;
  });

  function openImageDialog(img: Photo, itemId: string) {
    openDialog(DialogID.ItemImage, {
      params: {
        type: "preloaded",
        originalSrc: img.originalSrc,
        originalType: img.originalType,
        thumbnailSrc: img.thumbnailSrc,
        attachmentId: img.attachmentId,
        itemId,
      },
      onClose: result => {
        if (result?.action === "delete") {
          item.value!.attachments = item.value!.attachments.filter(a => a.id !== result.id);
        }
      },
    });
  }

  const currentUrl = computed(() => {
    return window.location.href;
  });

  const currentPath = computed(() => {
    return route.path;
  });

  const tabs = computed(() => {
    return [
      {
        id: "details",
        name: "global.details",
        to: `/item/${itemId.value}`,
      },
      {
        id: "log",
        name: "global.maintenance",
        to: `/item/${itemId.value}/maintenance`,
      },
      {
        id: "edit",
        name: "global.edit",
        to: `/item/${itemId.value}/edit`,
      },
    ];
  });

  const featuredPhoto = computed(() => displayPhotos.value[featuredIndex.value] ?? displayPhotos.value[0] ?? null);

  async function refreshItemList() {
    const id = itemId.value;
    const collection = collectionId.value;
    const current = shownItem.value;
    if (!current) {
      return;
    }
    const resp = await client().items.getAll({ parentIds: [current.id] });
    if (itemId.value !== id || collectionId.value !== collection || !shownItem.value) {
      return;
    }
    if (resp.error) {
      items.value = [];
      toast.error(t("items.toast.failed_load_items"));
      return;
    }
    items.value = resp.data?.items ?? [];
  }

  async function duplicateItem(settings?: DuplicateSettings) {
    if (!item.value) {
      return;
    }

    const duplicateSettings = settings
      ? {
          copyMaintenance: settings.copyMaintenance,
          copyAttachments: settings.copyAttachments,
          copyCustomFields: settings.copyCustomFields,
          copyPrefix: settings.copyPrefixOverride ?? t("items.duplicate.prefix"),
        }
      : {
          copyMaintenance: preferences.value.duplicateSettings.copyMaintenance,
          copyAttachments: preferences.value.duplicateSettings.copyAttachments,
          copyCustomFields: preferences.value.duplicateSettings.copyCustomFields,
          copyPrefix: preferences.value.duplicateSettings.copyPrefixOverride ?? t("items.duplicate.prefix"),
        };

    const { error, data } = await client().items.duplicate(itemId.value, duplicateSettings);

    if (error) {
      toast.error(t("items.toast.failed_duplicate_item"));
      return;
    }

    navigateTo(`/item/${data.id}`);
  }

  function handleDuplicateClick(event: MouseEvent) {
    if (event.shiftKey) {
      openDialog(DialogID.DuplicateTemporarySettings);
    } else {
      duplicateItem();
    }
  }

  const confirm = useConfirm();

  async function deleteItem() {
    const confirmed = await confirm.open(t("items.delete_item_confirm"));

    if (!confirmed.data) {
      return;
    }

    const { error } = await client().items.delete(itemId.value);
    if (error) {
      toast.error(t("items.toast.failed_delete_item"));
      return;
    }
    toast.success(t("items.toast.item_deleted"));
    navigateTo("/home");
  }

  async function saveAsTemplate() {
    if (!item.value) {
      return;
    }

    const NIL_UUID = "00000000-0000-0000-0000-000000000000";

    // Create template from item data
    const templateData = {
      name: `Template: ${item.value.name}`,
      description: "",
      notes: "",
      defaultName: item.value.name,
      defaultDescription: item.value.description || "",
      defaultQuantity: item.value.quantity,
      defaultInsured: item.value.insured,
      defaultManufacturer: item.value.manufacturer || "",
      defaultModelNumber: item.value.modelNumber || "",
      defaultLifetimeWarranty: item.value.lifetimeWarranty,
      defaultWarrantyDetails: item.value.warrantyDetails || "",
      defaultLocationId: item.value.location?.id || item.value.parent?.id || "",
      defaultTagIds: item.value.tags?.map(l => l.id) || [],
      includeWarrantyFields: !!(
        item.value.warrantyDetails ||
        item.value.lifetimeWarranty ||
        item.value.warrantyExpires
      ),
      includePurchaseFields: !!(item.value.purchaseFrom || item.value.purchasePrice || item.value.purchaseDate),
      includeSoldFields: !!(item.value.soldTo || item.value.soldPrice || item.value.soldDate),
      fields: item.value.fields.map(field => ({
        id: NIL_UUID,
        name: field.name,
        type: "text",
        textValue: field.textValue || "",
      })),
    };

    const { data, error } = await client().templates.create(templateData);
    if (error) {
      toast.error(t("components.template.toast.create_failed"));
      return;
    }

    toast.success(t("components.template.toast.saved_as_template", { name: templateData.name }));
    navigateTo(`/template/${data.id}`);
  }

  async function createSubitem() {
    openDialog(DialogID.CreateEntity, {
      params: {
        baseType: "item",
        subItem: true,
      },
    });
  }
</script>

<template>
  <Title v-if="shownItem">{{ shownItem.name }}</Title>
  <ItemImageDialog />
  <Dialog :dialog-id="DialogID.DuplicateTemporarySettings">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("items.duplicate.temporary_title") }}</DialogTitle>
      </DialogHeader>
      <ItemDuplicateSettings v-model="temporaryDuplicateSettings" />
      <DialogFooter>
        <Button
          @click="
            closeDialog(DialogID.DuplicateTemporarySettings);
            duplicateItem(temporaryDuplicateSettings);
          "
        >
          {{ $t("global.duplicate") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <BaseContainer
    v-if="purrfectDesktop && !shownItem"
    data-item-layout="purrfect"
    data-testid="item-state"
    :data-state="loadState"
  >
    <p v-if="loadState === 'loading'" role="status" class="text-sm text-muted-foreground">
      {{ $t("purrfect.item_loading") }}
    </p>
    <div v-else role="alert" class="max-w-lg space-y-3">
      <h1 class="text-2xl font-semibold">{{ $t("purrfect.item_unavailable_title") }}</h1>
      <p class="text-sm text-muted-foreground">
        {{
          $t("purrfect.item_unavailable_body", {
            collection: selectedCollection?.name || $t("purrfect.item_unavailable_collection"),
          })
        }}
      </p>
      <div class="flex gap-3">
        <Button type="button" data-testid="item-retry" @click="refresh">{{ $t("purrfect.item_retry") }}</Button>
        <Button as-child variant="outline">
          <NuxtLink to="/home">{{ $t("global.return_home") }}</NuxtLink>
        </Button>
      </div>
    </div>
  </BaseContainer>

  <BaseContainer v-else-if="purrfectDesktop && shownItem" class="pb-8">
    <ItemPurrfectDetail
      :item="shownItem"
      :crumbs="locationPresentation.crumbs"
      :location-segments="locationPresentation.locationSegments"
      :open-location-href="locationPresentation.openLocationHref"
      :photos="displayPhotos"
      :featured-photo="featuredPhoto"
      :asset-label="assetLabel"
      :description="descriptionText"
      :purchase-date="purchaseDate"
      :created-date="createdDate"
      :updated-date="updatedDate"
      :detail-rows="detailRows"
      :attachments="attachments"
      :extra-details="extraDetails"
      :warranty-details="warrantyDetails"
      :sold-details="soldDetails"
      :show-warranty="showWarranty === true"
      :show-sold="showSold === true"
      :children="items"
      :has-nested="hasNested"
      :show-empty="preferences.showEmpty === true"
      :current-url="currentUrl"
      @adjust="adjustQuantity"
      @open-photo="openImageDialog($event, shownItem.id)"
      @duplicate="handleDuplicateClick"
      @delete="deleteItem"
      @save-template="saveAsTemplate"
      @create-subitem="createSubitem"
      @refresh-children="refreshItemList"
      @update:show-empty="preferences.showEmpty = $event"
    >
      <template #nested>
        <NuxtPage :item="shownItem" :page-key="itemId" />
      </template>
    </ItemPurrfectDetail>
  </BaseContainer>

  <BaseContainer v-else-if="shownItem" data-item-layout="classic" data-testid="classic-item">
    <template v-if="item">
      <section>
        <Card class="p-3">
          <header :class="{ 'mb-2': item.description }">
            <div class="flex flex-wrap items-end gap-2">
              <div
                class="mb-auto flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <MdiPackageVariant class="size-7" />
              </div>
              <div>
                <Breadcrumb v-if="itemPath.length > 0">
                  <BreadcrumbList>
                    <BreadcrumbItem v-for="(part, idx) in itemPath" :key="part.id">
                      <BreadcrumbLink
                        v-if="idx < itemPath.length - 1"
                        as-child
                        class="text-foreground/70 hover:underline"
                      >
                        <NuxtLink :to="`/${part.type}/${part.id}`">
                          {{ part.name }}
                        </NuxtLink>
                      </BreadcrumbLink>
                      <template v-else>
                        {{ part.name }}
                      </template>
                      <BreadcrumbSeparator v-if="idx < itemPath.length - 1" :key="`sep-${part.id}`" />
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <h1 class="text-wrap pb-1 text-2xl">
                  {{ item ? item.name : "" }}
                </h1>
                <div class="flex flex-wrap gap-2 pb-1">
                  <TagChip v-for="tag in itemTags" :key="tag.id" :tag="tag" size="sm" :ancestors="tag.ancestors" />
                </div>
                <div class="flex flex-wrap gap-1 text-wrap text-xs">
                  <div>
                    {{ $t("items.created_at") }}
                    <DateTime :date="item?.createdAt" />
                  </div>
                  -
                  <div>
                    {{ $t("items.updated_at") }}
                    <DateTime :date="item?.updatedAt" />
                  </div>
                </div>
              </div>
              <div class="ml-auto mt-2 flex flex-wrap items-center justify-between gap-2">
                <LabelMaker
                  v-if="typeof item.assetId === 'string' && item.assetId != ''"
                  :id="item.assetId"
                  type="asset"
                />
                <LabelMaker v-else :id="item.id" type="item" />
                <Button class="w-9 md:w-auto" :aria-label="$t('global.create_subitem')" @click="createSubitem">
                  <MdiPlus />
                  <span class="hidden md:inline">{{ $t("global.create_subitem") }}</span>
                </Button>

                <!-- More actions dropdown -->
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="outline" size="icon" :aria-label="$t('global.more_actions')">
                      <MdiDotsVertical class="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-48">
                    <DropdownMenuItem @click="handleDuplicateClick">
                      <MdiPlusBoxMultipleOutline class="mr-2 size-4" />
                      {{ $t("global.duplicate") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="saveAsTemplate">
                      <MdiContentSaveEdit class="mr-2 size-4" />
                      {{ $t("components.template.save_as_template") }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-destructive focus:text-destructive" @click="deleteItem">
                      <MdiDelete class="mr-2 size-4" />
                      {{ $t("global.delete") }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <Separator v-if="item.description" />
          <div v-if="item.description" class="prose max-w-full p-1">
            <Markdown class="text-base" :source="item.description" />
          </div>
        </Card>

        <div class="mb-6 mt-3 flex flex-wrap items-center justify-between">
          <ButtonGroup>
            <Button
              v-for="tab in tabs"
              :key="tab.id"
              as-child
              :variant="tab.to === currentPath ? 'default' : 'outline'"
              size="sm"
            >
              <NuxtLink :to="tab.to">
                {{ $t(tab.name) }}
              </NuxtLink>
            </Button>
          </ButtonGroup>
        </div>
      </section>

      <section>
        <div class="space-y-6">
          <!-- this renders the other pages content -->
          <NuxtPage :item="item" :page-key="itemId" />

          <!-- anything in this is not rendered if on another page -->
          <BaseCard v-if="!hasNested" collapsable>
            <template #title> {{ $t("items.details") }} </template>
            <template #title-actions>
              <div class="mt-2 flex flex-wrap items-center justify-between gap-4">
                <Label class="flex cursor-pointer items-center gap-2">
                  <Switch v-model="preferences.showEmpty" />
                  {{ $t("items.show_empty") }}
                </Label>
                <div class="space-x-1">
                  <CopyText :text="currentUrl" :icon-size="16" />
                </div>
              </div>
            </template>
            <DetailsSection :details="itemDetails">
              <template #quantity="{ detail }">
                <div class="flex items-center">
                  {{ detail.text }}
                  <span
                    class="my-0 ml-4 inline-flex gap-2 opacity-10 transition-opacity duration-75 group-hover:opacity-100"
                  >
                    <Button size="icon" variant="outline" class="size-8 rounded-full" @click="adjustQuantity(-1)">
                      <MdiMinus class="size-3" />
                    </Button>
                    <Button size="icon" variant="outline" class="size-8 rounded-full" @click="adjustQuantity(1)">
                      <MdiPlus class="size-3" />
                    </Button>
                  </span>
                </div>
              </template>
            </DetailsSection>
          </BaseCard>

          <!-- anything in this is not rendered if on another page -->
          <template v-if="!hasNested">
            <BaseCard v-if="photos && photos.length > 0">
              <template #title> {{ $t("items.photos") }} </template>
              <div
                class="scroll-bg container mx-auto flex max-h-[500px] flex-wrap gap-2 overflow-y-scroll border-t p-4"
              >
                <button v-for="(img, i) in photos" :key="i" @click="openImageDialog(img, item.id)">
                  <img class="max-h-[200px] rounded" :src="img.thumbnailSrc" :alt="$t('items.photo')" loading="lazy" />
                </button>
              </div>
            </BaseCard>

            <BaseCard v-if="showAttachments" collapsable>
              <template #title> {{ $t("items.attachments") }} </template>
              <DetailsSection v-if="attachmentDetails.length > 0" :details="attachmentDetails">
                <template #manuals>
                  <ItemAttachmentsList
                    v-if="attachments.manuals.length > 0"
                    :attachments="attachments.manuals"
                    :item-id="item.id"
                  />
                </template>
                <template #attachments>
                  <ItemAttachmentsList
                    v-if="attachments.attachments.length > 0"
                    :attachments="attachments.attachments"
                    :item-id="item.id"
                  />
                </template>
                <template #warranty>
                  <ItemAttachmentsList
                    v-if="attachments.warranty.length > 0"
                    :attachments="attachments.warranty"
                    :item-id="item.id"
                  />
                </template>
                <template #receipts>
                  <ItemAttachmentsList
                    v-if="attachments.receipts.length > 0"
                    :attachments="attachments.receipts"
                    :item-id="item.id"
                  />
                </template>
              </DetailsSection>
              <div v-else>
                <p class="px-6 pb-4 text-foreground/70">{{ $t("items.no_attachments") }}</p>
              </div>
            </BaseCard>

            <BaseCard v-if="showPurchase" collapsable>
              <template #title> {{ $t("items.purchase_details") }} </template>
              <DetailsSection :details="purchaseDetails" />
            </BaseCard>

            <BaseCard v-if="showWarranty" collapsable>
              <template #title> {{ $t("items.warranty_details") }} </template>
              <DetailsSection :details="warrantyDetails" />
            </BaseCard>

            <BaseCard v-if="showSold" collapsable>
              <template #title> {{ $t("items.sold_details") }} </template>
              <DetailsSection :details="soldDetails" />
            </BaseCard>
          </template>
        </div>
      </section>

      <section v-if="items && items.length > 0" class="mt-6">
        <ItemViewSelectable :items="items" @refresh="refreshItemList" />
      </section>
    </template>
  </BaseContainer>
  <BaseContainer v-else data-item-layout="classic" data-testid="classic-item-state" :data-state="loadState">
    <p v-if="loadState === 'loading'" role="status" class="text-sm text-muted-foreground">
      {{ $t("global.loading") }}
    </p>
  </BaseContainer>
</template>

<style lang="css" scoped>
  /* Style dialog background */
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
