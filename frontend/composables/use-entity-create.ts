import { inject, provide, type InjectionKey } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/sonner";
import { DialogID } from "~/components/ui/dialog-provider/utils";
import { useDialog } from "~/components/ui/dialog-provider";
import type {
  EntitySummary,
  EntityTemplateOut,
  EntityTemplateSummary,
  EntityTypeSummary,
} from "~~/lib/api/types/data-contracts";
import {
  LAST_TEMPLATE_STORAGE_KEY,
  SHELF_PREVIEW_PAGE_SIZE,
  buildCreateRequest,
  chooseFilingLocation,
  emptyCreateDraft,
  locationChain,
  locationRowState,
  shelfPreviewPhase,
  shelfRows,
  shouldApplyShelfPreview,
  templateApplyFields,
  type CreateDraft,
  type ShelfRow,
} from "~~/lib/entity-create";
import { acceptInventoryNavigation, inventoryDestinationHref, type InventoryContext } from "~~/lib/inventory-context";
import { notifyContextualItemCreated } from "~~/lib/contextual-create";
import { useEntityTypeStore } from "~~/stores/entityTypes";
import { useLocationStore } from "~~/stores/locations";
import { useTagStore } from "~/stores/tags";

type LocationStatus = "loading" | "ready" | "error";
type PreviewStatus = "idle" | "loading" | "ready" | "error";

/**
 * Design C creation state. The dialog keeps its own lifecycle and calls the
 * same payload helpers. This composable is the page: validated destination,
 * template defaults that cannot move an explicit shelf, and the shelf preview.
 */
type EntityCreateApi = ReturnType<typeof useEntityCreate>;
const entityCreateKey: InjectionKey<EntityCreateApi> = Symbol("entity-create");

export function provideEntityCreate() {
  const api = useEntityCreate();
  provide(entityCreateKey, api);
  return api;
}

export function useProvidedEntityCreate() {
  const api = inject(entityCreateKey);
  if (!api) {
    throw new Error("Entity create form is outside its page");
  }
  return api;
}

export function useEntityCreate() {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const api = useUserApi();
  const { openDialog } = useDialog();
  const { selectedId, selectedCollection } = useCollections();
  const locationsStore = useLocationStore();
  const entityTypeStore = useEntityTypeStore();
  const tagStore = useTagStore();

  const draft = reactive<CreateDraft>(emptyCreateDraft());
  const touched = reactive({
    name: false,
    description: false,
    quantity: false,
    tags: false,
    insured: false,
    location: false,
  });

  const locationStatus = ref<LocationStatus>("loading");
  const locations = ref<EntitySummary[]>([]);
  const requestedDestinationId = ref<string | null>(null);
  const confirmedLocationId = ref<string | null>(null);
  const rejectedExplicit = ref(false);
  const context = ref<InventoryContext>({});
  const contextual = ref(false);

  const templateData = ref<EntityTemplateOut | null>(null);
  const selectedTemplate = ref<EntityTemplateSummary | null>(null);
  const templateUserSelected = ref(false);
  const selectedEntityType = ref<EntityTypeSummary | null>(null);

  const previewStatus = ref<PreviewStatus>("idle");
  const previewRows = ref<ShelfRow[]>([]);
  const previewPartial = ref(false);
  const saving = ref(false);
  const fieldError = ref("");
  let locationToken = 0;
  let previewToken = 0;
  let submitLock = false;

  const entityTypes = computed(() => entityTypeStore.itemTypes);
  const tags = computed(() => tagStore.tags);
  const tagsStatus = computed(() => tagStore.tagsStatus);
  const collectionName = computed(() => selectedCollection.value?.name?.trim() || "");

  const rowState = computed(() =>
    locationRowState({
      status: locationStatus.value,
      requestedId: requestedDestinationId.value,
      confirmedId: confirmedLocationId.value,
    })
  );

  const chain = computed(() =>
    confirmedLocationId.value ? locationChain(confirmedLocationId.value, locations.value) : []
  );

  const shelfPhase = computed(() =>
    shelfPreviewPhase({
      locationId: confirmedLocationId.value,
      status: previewStatus.value,
      count: previewRows.value.length,
    })
  );

  const selectedLocation = computed(
    () => locations.value.find(location => location.id === confirmedLocationId.value) ?? null
  );

  function readContext() {
    const accepted = acceptInventoryNavigation(route.fullPath, {
      currentCollectionId: selectedId.value,
    });
    if (!accepted.ok) {
      context.value = {};
      requestedDestinationId.value = null;
      contextual.value = false;
      return;
    }
    context.value = accepted.navigation.context;
    requestedDestinationId.value = accepted.navigation.context.destinationId ?? null;
    contextual.value = Boolean(accepted.navigation.context.destinationId);
  }

  function applyChoice(templateLocationId?: string | null) {
    if (locationStatus.value !== "ready") {
      return;
    }
    const choice = chooseFilingLocation({
      explicitDestinationId: touched.location ? null : requestedDestinationId.value,
      templateLocationId: touched.location ? null : templateLocationId,
      knownLocationIds: locations.value.map(location => location.id),
      collectionId: context.value.collectionId,
      currentCollectionId: selectedId.value,
    });
    rejectedExplicit.value = choice.rejectedExplicit;
    if (touched.location) {
      return;
    }
    confirmedLocationId.value = choice.locationId;
    draft.locationId = choice.locationId ?? "";
  }

  function applyTemplate(template: EntityTemplateOut, mode: "fill-empty" | "overwrite") {
    const fill = mode === "fill-empty";
    const applied = templateApplyFields(template, {
      keepLocation: Boolean(requestedDestinationId.value) || touched.location,
    });
    if (applied.name && (!fill || (!touched.name && !draft.name))) {
      draft.name = applied.name;
    }
    if (applied.description && (!fill || (!touched.description && !draft.description))) {
      draft.description = applied.description;
    }
    if (applied.quantity != null && (!fill || !touched.quantity)) {
      draft.quantity = applied.quantity;
    }
    if (typeof applied.insured === "boolean" && (!fill || !touched.insured)) {
      draft.insured = applied.insured;
    }
    if (applied.tagIds && (!fill || (!touched.tags && draft.tagIds.length === 0))) {
      draft.tagIds = applied.tagIds;
    }
    if (applied.manufacturer && !draft.manufacturer) {
      draft.manufacturer = applied.manufacturer;
    }
    if (applied.modelNumber && !draft.modelNumber) {
      draft.modelNumber = applied.modelNumber;
    }
    applyChoice(applied.locationId);
  }

  async function loadTemplate(id: string, userSelected: boolean) {
    const { data, error } = await api.templates.get(id);
    if (error || !data) {
      if (userSelected) {
        toast.error(t("components.template.toast.load_failed"));
      } else {
        localStorage.removeItem(LAST_TEMPLATE_STORAGE_KEY);
      }
      return;
    }
    templateData.value = data;
    selectedTemplate.value = {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
    templateUserSelected.value = userSelected;
    applyTemplate(data, userSelected ? "overwrite" : "fill-empty");
    if (userSelected) {
      localStorage.setItem(LAST_TEMPLATE_STORAGE_KEY, data.id);
      toast.success(t("components.template.toast.applied", { name: data.name }));
    }
  }

  async function restoreLastTemplate() {
    const id = localStorage.getItem(LAST_TEMPLATE_STORAGE_KEY);
    if (!id) {
      return false;
    }
    await loadTemplate(id, false);
    templateUserSelected.value = true;
    return templateData.value != null;
  }

  async function onEntityTypeChanged(typeId: string) {
    const next = entityTypes.value.find(type => type.id === typeId) ?? null;
    selectedEntityType.value = next;
    draft.entityTypeId = next?.id ?? "";
    if (!next || templateUserSelected.value) {
      return;
    }
    if (!next.defaultTemplateId) {
      return;
    }
    await loadTemplate(next.defaultTemplateId, false);
  }

  async function refreshLocations() {
    const token = ++locationToken;
    const collectionAtStart = selectedId.value;
    locationStatus.value = "loading";
    const [list] = await Promise.all([
      locationsStore.refreshChildren(),
      locationsStore.refreshTree(),
      entityTypeStore.ensureFetched().catch(() => undefined),
      tagStore.ensureAllTagsFetched().catch(() => undefined),
    ]);
    if (token !== locationToken || selectedId.value !== collectionAtStart) {
      return;
    }
    if (list.error) {
      locationStatus.value = "error";
      locations.value = [];
      confirmedLocationId.value = null;
      draft.locationId = "";
      clearPreview();
      return;
    }
    locations.value = locationsStore.allLocations;
    locationStatus.value = "ready";
    if (!selectedEntityType.value) {
      const first = entityTypes.value[0] ?? null;
      selectedEntityType.value = first;
      draft.entityTypeId = first?.id ?? "";
    }
    applyChoice(templateData.value?.defaultLocation?.id);
    await loadPreview(confirmedLocationId.value);
  }

  function clearPreview() {
    previewToken += 1;
    previewStatus.value = "idle";
    previewRows.value = [];
    previewPartial.value = false;
  }

  async function loadPreview(locationId: string | null) {
    const token = ++previewToken;
    if (!locationId) {
      previewStatus.value = "idle";
      previewRows.value = [];
      previewPartial.value = false;
      return;
    }
    previewStatus.value = "loading";
    previewRows.value = [];
    previewPartial.value = false;
    const resp = await api.items.getAll({
      parentIds: [locationId],
      page: 1,
      pageSize: SHELF_PREVIEW_PAGE_SIZE,
    });
    if (!shouldApplyShelfPreview(token, previewToken, locationId, confirmedLocationId.value ?? "")) {
      return;
    }
    if (resp.error || !resp.data) {
      previewStatus.value = "error";
      previewRows.value = [];
      previewPartial.value = false;
      return;
    }
    const items = resp.data.items ?? [];
    previewRows.value = shelfRows(items, locationId);
    previewPartial.value = resp.data.total > items.length;
    previewStatus.value = "ready";
  }

  function setLocation(location: EntitySummary | null) {
    touched.location = true;
    rejectedExplicit.value = false;
    requestedDestinationId.value = null;
    confirmedLocationId.value = location?.id ?? null;
    draft.locationId = location?.id ?? "";
    contextual.value = contextual.value && Boolean(context.value.rootLocationId);
    void loadPreview(confirmedLocationId.value);
  }

  async function selectTemplate(template: EntityTemplateSummary | null) {
    if (!template) {
      templateData.value = null;
      selectedTemplate.value = null;
      templateUserSelected.value = false;
      localStorage.removeItem(LAST_TEMPLATE_STORAGE_KEY);
      return;
    }
    await loadTemplate(template.id, true);
  }

  function clearTemplate() {
    templateData.value = null;
    selectedTemplate.value = null;
    templateUserSelected.value = false;
    localStorage.removeItem(LAST_TEMPLATE_STORAGE_KEY);
  }

  function markTouched(field: keyof typeof touched) {
    touched[field] = true;
  }

  function errorText(reason: string): string {
    switch (reason) {
      case "missing-name":
      case "name-too-long":
        return t("purrfect.add_name_required");
      case "missing-location":
        return t("components.entity.create_modal.toast.please_select_location");
      case "missing-type":
        return t("purrfect.add_no_type");
      case "invalid-price":
        return t("purrfect.add_price_invalid");
      case "invalid-quantity":
        return t("purrfect.add_quantity_invalid");
      case "purchase-from-too-long":
        return t("purrfect.add_vendor_too_long");
      default:
        return t("components.entity.create_modal.toast.create_failed", { type: t("global.item") });
    }
  }

  async function save() {
    if (submitLock || saving.value) {
      return;
    }
    submitLock = true;
    fieldError.value = "";
    const request = buildCreateRequest({
      name: draft.name,
      description: draft.description,
      quantity: draft.quantity,
      purchasePrice: draft.purchasePrice,
      purchaseFrom: draft.purchaseFrom,
      insured: draft.insured,
      tagIds: [...draft.tagIds],
      knownTagIds: tagsStatus.value === "ready" ? tags.value.map(tag => tag.id) : undefined,
      locationId: confirmedLocationId.value ?? "",
      entityTypeId: draft.entityTypeId,
      manufacturer: draft.manufacturer,
      modelNumber: draft.modelNumber,
      templateId: templateData.value?.id,
    });
    if (!request.ok) {
      fieldError.value = errorText(request.reason);
      submitLock = false;
      return;
    }

    saving.value = true;
    const result =
      request.kind === "template"
        ? await api.templates.createItem(request.templateId, request.body)
        : await api.items.create(request.body);
    if (result.error || !result.data) {
      saving.value = false;
      submitLock = false;
      fieldError.value = t("components.entity.create_modal.toast.create_failed", { type: t("global.item") });
      return;
    }

    const createdId = result.data.id;
    const origin = context.value.rootLocationId;
    Object.assign(draft, emptyCreateDraft());
    templateData.value = null;
    if (origin && contextual.value) {
      notifyContextualItemCreated();
      const href = inventoryDestinationHref({ kind: "location", rootLocationId: origin }, context.value);
      await navigateTo(href ?? `/location/${origin}`);
      return;
    }
    await navigateTo(`/item/${createdId}`);
  }

  function cancel() {
    if (saving.value) {
      return;
    }
    if (import.meta.client && window.history.length > 1) {
      router.back();
      return;
    }
    const origin = context.value.rootLocationId;
    if (origin) {
      void navigateTo(`/location/${origin}`);
      return;
    }
    void navigateTo("/home");
  }

  function openExistingForm() {
    openDialog(DialogID.CreateEntity, {
      params: contextual.value
        ? {
            baseType: "item",
            contextualReturn: true,
            collectionId: context.value.collectionId,
            rootLocationId: context.value.rootLocationId,
            branchId: context.value.branchId,
            destinationId: confirmedLocationId.value ?? context.value.destinationId,
            sourceItemId: context.value.sourceItemId,
          }
        : { baseType: "item" },
    });
  }

  function openScanner() {
    openDialog(DialogID.Scanner);
  }

  function openBarcode() {
    openDialog(DialogID.ProductImport);
  }

  function openLocationCreate() {
    openDialog(DialogID.CreateEntity, { params: { baseType: "location" } });
  }

  onMounted(async () => {
    readContext();
    if (locationsStore.allLocations.length > 0) {
      locations.value = locationsStore.allLocations;
      locationStatus.value = "ready";
      applyChoice(null);
    }
    await restoreLastTemplate();
    await refreshLocations();
  });

  watch(selectedId, () => {
    readContext();
    touched.location = false;
    confirmedLocationId.value = null;
    draft.locationId = "";
    clearPreview();
    void refreshLocations();
  });

  return {
    draft,
    saving,
    fieldError,
    contextual,
    context,
    collectionName,
    rowState,
    chain,
    rejectedExplicit,
    shelfPhase,
    previewRows,
    previewPartial,
    selectedLocation,
    entityTypes,
    selectedEntityType,
    tags,
    tagsStatus,
    templateData,
    selectedTemplate,
    setLocation,
    selectTemplate,
    clearTemplate,
    onEntityTypeChanged,
    markTouched,
    save,
    cancel,
    retryLocations: refreshLocations,
    retryPreview: () => loadPreview(confirmedLocationId.value),
    openExistingForm,
    openScanner,
    openBarcode,
    openLocationCreate,
  };
}
