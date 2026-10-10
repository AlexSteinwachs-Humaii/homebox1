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
  SAFE_CREATE_EXIT,
  SHELF_PREVIEW_PAGE_SIZE,
  buildCreateRequest,
  chooseFilingLocation,
  classifyCreateResult,
  compatibleCreateIds,
  consumeDraftClear,
  emptyCreateDraft,
  locationChain,
  locationRowState,
  resolveCreateExit,
  serverCreateDetail,
  settleSave,
  shelfPreviewPhase,
  shelfRows,
  shouldApplyShelfPreview,
  startSave,
  templateApplyFields,
  type CreateDraft,
  type SaveSession,
  type ShelfRow,
} from "~~/lib/entity-create";
import { acceptInventoryNavigation, type InventoryContext } from "~~/lib/inventory-context";
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
  const session = ref<SaveSession>({ phase: "idle", draftCleared: false });
  let draftClearConsumed = false;
  let locationToken = 0;
  let previewToken = 0;
  let writeGeneration = 0;
  /** Collection whose location list was confirmed. A save before this is refused. */
  const locationsCollectionId = ref<string | null>(null);

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
    const { data, error } = await useUserApi().templates.get(id);
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
    const generationAtStart = writeGeneration;
    const collectionAtStart = selectedId.value;
    locationStatus.value = "loading";
    locationsCollectionId.value = null;
    const client = useUserApi();
    const [list, typesResult] = await Promise.all([
      locationsStore.refreshChildren(),
      client.entityTypes.getAll().catch(() => null),
      locationsStore.refreshTree(),
      tagStore.refresh().catch(() => undefined),
    ]);
    if (token !== locationToken || generationAtStart !== writeGeneration || selectedId.value !== collectionAtStart) {
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
    if (typesResult && !typesResult.error && Array.isArray(typesResult.data)) {
      entityTypeStore.types = typesResult.data;
    }
    locationStatus.value = "ready";
    locationsCollectionId.value = collectionAtStart;
    const compatible = compatibleCreateIds({
      locationId: confirmedLocationId.value,
      templateId: templateData.value?.id,
      entityTypeId: draft.entityTypeId,
      tagIds: draft.tagIds,
      knownLocationIds: locations.value.map(location => location.id),
      knownTagIds: tagStore.tagsStatus === "ready" ? tagStore.tags.map(tag => tag.id) : null,
      knownTypeIds: entityTypes.value.map(type => type.id),
      knownTemplateIds: templateData.value ? [templateData.value.id] : [],
    });
    if (!compatible.templateId) {
      templateData.value = null;
      selectedTemplate.value = null;
      templateUserSelected.value = false;
    }
    draft.tagIds = compatible.tagIds;
    const typeStillKnown = entityTypes.value.find(type => type.id === compatible.entityTypeId) ?? null;
    if (!selectedEntityType.value || !typeStillKnown) {
      const first = typeStillKnown ?? entityTypes.value[0] ?? null;
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
    const resp = await useUserApi().items.getAll({
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
      case "description-too-long":
        return t("purrfect.add_description_too_long");
      case "purchase-from-too-long":
        return t("purrfect.add_vendor_too_long");
      default:
        return t("components.entity.create_modal.toast.create_failed", { type: t("global.item") });
    }
  }

  function fieldLabel(key: string): string {
    switch (key) {
      case "name":
        return t("global.name");
      case "description":
        return t("global.details");
      case "quantity":
        return t("global.quantity");
      case "purchasePrice":
        return t("items.purchase_price");
      case "purchaseFrom":
        return t("items.purchased_from");
      case "parentId":
        return t("items.location");
      case "tagIds":
        return t("purrfect.add_tags_optional");
      case "insured":
        return t("global.insured");
      default:
        return key;
    }
  }

  function formatServerError(data: unknown): string {
    const detail = serverCreateDetail(data);
    const parts = Object.entries(detail.fields).map(([key, value]) => `${fieldLabel(key)}: ${value}`);
    if (parts.length > 0) {
      return parts.join(" ");
    }
    if (detail.message) {
      return detail.message;
    }
    return t("components.entity.create_modal.toast.create_failed", { type: t("global.item") });
  }

  function exitHref(intent: "cancel" | "save", createdId?: string | null) {
    return resolveCreateExit({
      intent,
      createdId,
      context: context.value,
      knownLocationIds: locations.value.map(location => location.id),
      currentCollectionId: selectedId.value,
      reportedDestinationId: confirmedLocationId.value,
      locations: locations.value,
    }).href;
  }

  function releaseRejected() {
    session.value = settleSave(session.value, "rejected");
    saving.value = false;
  }

  function clearDraftOnce() {
    if (!consumeDraftClear(session.value, draftClearConsumed)) {
      return;
    }
    draftClearConsumed = true;
    const typeId = draft.entityTypeId;
    Object.assign(draft, emptyCreateDraft());
    draft.entityTypeId = typeId;
    draft.locationId = "";
    confirmedLocationId.value = null;
    templateData.value = null;
    selectedTemplate.value = null;
    templateUserSelected.value = false;
  }

  async function refreshAfterCreate() {
    try {
      await locationsStore.refreshChildren();
      await locationsStore.refreshTree();
    } catch {
      // A failed refresh is not another create.
    }
    try {
      clearNuxtData(
        (key: string) => key.startsWith("location:") || key.includes("statistics") || key.endsWith("_item_list")
      );
    } catch {
      // Cache clearing is best-effort. The location page still loads on arrival.
    }
    notifyContextualItemCreated();
  }

  async function save() {
    const next = startSave(session.value);
    if (!next) {
      return;
    }
    session.value = next;
    saving.value = true;
    fieldError.value = "";
    const generation = writeGeneration;
    const collectionAtSubmit = selectedId.value;

    const stale = () => generation !== writeGeneration || selectedId.value !== collectionAtSubmit;

    if (locationsCollectionId.value !== collectionAtSubmit || locationStatus.value !== "ready") {
      fieldError.value = t("purrfect.add_not_ready");
      releaseRejected();
      return;
    }

    const compatible = compatibleCreateIds({
      locationId: confirmedLocationId.value,
      templateId: templateData.value?.id,
      entityTypeId: draft.entityTypeId,
      tagIds: [...draft.tagIds],
      knownLocationIds: locations.value.map(location => location.id),
      knownTagIds: tagsStatus.value === "ready" ? tags.value.map(tag => tag.id) : null,
      knownTypeIds: entityTypes.value.map(type => type.id),
      knownTemplateIds: templateData.value ? [templateData.value.id] : [],
    });
    if (confirmedLocationId.value && !compatible.locationId) {
      confirmedLocationId.value = null;
      draft.locationId = "";
      fieldError.value = t("purrfect.add_location_rejected");
      releaseRejected();
      return;
    }
    if (draft.tagIds.some(id => !compatible.tagIds.includes(id))) {
      draft.tagIds = compatible.tagIds;
      fieldError.value = t("purrfect.add_tags_rejected");
      releaseRejected();
      return;
    }

    const request = buildCreateRequest({
      name: draft.name,
      description: draft.description,
      quantity: draft.quantity,
      purchasePrice: draft.purchasePrice,
      purchaseFrom: draft.purchaseFrom,
      insured: draft.insured,
      tagIds: compatible.tagIds,
      knownTagIds: tagsStatus.value === "ready" ? tags.value.map(tag => tag.id) : undefined,
      locationId: compatible.locationId ?? "",
      entityTypeId: compatible.entityTypeId ?? "",
      manufacturer: draft.manufacturer,
      modelNumber: draft.modelNumber,
      templateId: compatible.templateId,
    });
    if (!request.ok) {
      fieldError.value = errorText(request.reason);
      releaseRejected();
      return;
    }
    if (stale()) {
      session.value = settleSave(session.value, "stale");
      saving.value = false;
      fieldError.value = t("purrfect.add_stale_write");
      return;
    }

    const client = useUserApi();
    let thrown = false;
    let status: number | null = null;
    let data: { id?: string } | null = null;
    let failed = false;
    try {
      const result =
        request.kind === "template"
          ? await client.templates.createItem(request.templateId, request.body)
          : await client.items.create(request.body);
      status = result.status;
      failed = Boolean(result.error);
      data = result.data;
    } catch {
      thrown = true;
    }

    if (stale()) {
      session.value = settleSave(session.value, "stale");
      saving.value = false;
      fieldError.value = t("purrfect.add_stale_write");
      return;
    }

    const classified = classifyCreateResult({
      thrown,
      status,
      id: !thrown && !failed ? data?.id : undefined,
    });
    if (classified.kind === "uncertain") {
      session.value = settleSave(session.value, "uncertain");
      saving.value = false;
      fieldError.value = t("purrfect.add_uncertain");
      return;
    }
    if (classified.kind === "rejected") {
      fieldError.value = formatServerError(data);
      releaseRejected();
      return;
    }

    const href = exitHref("save", classified.id);
    session.value = settleSave(session.value, "created");
    clearDraftOnce();
    await refreshAfterCreate();
    if (stale()) {
      fieldError.value = t("purrfect.add_stale_write");
      return;
    }
    await navigateTo(href);
  }

  function cancel() {
    if (saving.value) {
      return;
    }
    const href = exitHref("cancel");
    void navigateTo(href || SAFE_CREATE_EXIT);
  }

  function openExistingForm() {
    if (saving.value || session.value.phase === "uncertain" || session.value.phase === "saved") {
      return;
    }
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

  function writesBlocked() {
    return saving.value || session.value.phase === "uncertain" || session.value.phase === "saved";
  }

  function openScanner() {
    if (writesBlocked()) {
      return;
    }
    openDialog(DialogID.Scanner);
  }

  function openBarcode() {
    if (writesBlocked()) {
      return;
    }
    openDialog(DialogID.ProductImport);
  }

  function openLocationCreate() {
    if (writesBlocked()) {
      return;
    }
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

  watch(selectedId, (next, previous) => {
    if (next === previous) {
      return;
    }
    writeGeneration += 1;
    locationsCollectionId.value = null;
    const hadBindings = Boolean(
      confirmedLocationId.value || templateData.value || draft.tagIds.length || context.value.rootLocationId
    );
    const wasSaving = saving.value;
    readContext();
    touched.location = false;
    confirmedLocationId.value = null;
    draft.locationId = "";
    draft.tagIds = [];
    templateData.value = null;
    selectedTemplate.value = null;
    templateUserSelected.value = false;
    selectedEntityType.value = null;
    draft.entityTypeId = "";
    clearPreview();
    locationsStore.prepareForCollection(next);
    tagStore.prepareForCollection(next);
    entityTypeStore.types = null;
    if (session.value.phase !== "uncertain" && session.value.phase !== "saved") {
      session.value = { phase: wasSaving ? "stale" : "idle", draftCleared: session.value.draftCleared };
      saving.value = false;
    }
    if (wasSaving) {
      fieldError.value = t("purrfect.add_stale_write");
    } else if (hadBindings && session.value.phase !== "uncertain") {
      fieldError.value = t("purrfect.add_collection_changed");
    }
    void refreshLocations();
  });

  return {
    draft,
    saving,
    fieldError,
    outcome: computed(() => session.value.phase),
    submitBlocked: computed(
      () => saving.value || session.value.phase === "uncertain" || session.value.phase === "saved"
    ),
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
