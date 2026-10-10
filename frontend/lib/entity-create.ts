/**
 * Shared item-creation rules for the existing dialog and the Design C page.
 *
 * Sample copy from the add-item artboard is not a default. A blank draft
 * stays blank. An explicit filing place wins over a template or type default.
 * Purchase fields are omitted when the person left them empty so the create
 * insert keeps the column defaults instead of a pictured price or vendor.
 */

import type { EntityCreate, EntityTemplateCreateItemRequest } from "~~/lib/api/types/data-contracts";
import {
  explicitCreateLocationId,
  inventoryDestinationHref,
  parseInventoryId,
  type InventoryContext,
  type InventoryId,
} from "~~/lib/inventory-context";
import { knownAmount } from "~~/lib/inventory-visuals";

export const LAST_TEMPLATE_STORAGE_KEY = "homebox:lastUsedTemplate";

/** Page size for the exact-shelf preview. Direct parent only. */
export const SHELF_PREVIEW_PAGE_SIZE = 50;

const MAX_NAME = 255;
const MAX_DESCRIPTION = 1000;
const MAX_PURCHASE_FROM = 255;

/**
 * Words drawn on the add-item artboard. They are an example, never a draft.
 * A person may still type them; they are only forbidden as silent defaults.
 */
export const ARTBOARD_SAMPLE = {
  name: "Litter mat",
  description: "Washable mat. Sits on the top shelf, in front of the carrier, so the shelf stays dry.",
  purchaseFrom: "Neighborhood pet shop",
  purchasePrice: 16,
  tags: ["Travel", "Food", "Toys", "Household"],
} as const;

export type CreateDraft = {
  name: string;
  description: string;
  quantity: number;
  purchasePrice: string;
  purchaseFrom: string;
  insured: boolean;
  tagIds: string[];
  locationId: string;
  entityTypeId: string;
  manufacturer: string;
  modelNumber: string;
  parentId: string;
};

export function emptyCreateDraft(): CreateDraft {
  return {
    name: "",
    description: "",
    quantity: 1,
    purchasePrice: "",
    purchaseFrom: "",
    insured: false,
    tagIds: [],
    locationId: "",
    entityTypeId: "",
    manufacturer: "",
    modelNumber: "",
    parentId: "",
  };
}

export function draftUsesArtboardSample(
  draft: Pick<CreateDraft, "name" | "description" | "purchaseFrom" | "purchasePrice" | "tagIds">
): boolean {
  return (
    draft.name.trim() === ARTBOARD_SAMPLE.name ||
    draft.description.trim() === ARTBOARD_SAMPLE.description ||
    draft.purchaseFrom.trim() === ARTBOARD_SAMPLE.purchaseFrom ||
    draft.purchasePrice.trim() === String(ARTBOARD_SAMPLE.purchasePrice) ||
    draft.purchasePrice.trim() === `$${ARTBOARD_SAMPLE.purchasePrice}` ||
    draft.purchasePrice.trim() === `$${ARTBOARD_SAMPLE.purchasePrice}.00` ||
    ARTBOARD_SAMPLE.tags.some(tag => draft.tagIds.includes(tag))
  );
}

export type TemplateLike = {
  defaultName?: string | null;
  defaultDescription?: string | null;
  defaultQuantity?: number | null;
  defaultInsured?: boolean | null;
  defaultLocation?: { id?: string | null } | null;
  defaultTags?: Array<{ id?: string | null }> | null;
  defaultManufacturer?: string | null;
  defaultModelNumber?: string | null;
};

export type TemplateApply = {
  name?: string;
  description?: string;
  quantity?: number;
  insured?: boolean;
  locationId?: string;
  tagIds?: string[];
  manufacturer?: string;
  modelNumber?: string;
};

/**
 * Fields a template may fill. Location is omitted when an explicit filing
 * place is already chosen — the opened shelf wins over the template.
 */
export function templateApplyFields(template: TemplateLike, options: { keepLocation: boolean }): TemplateApply {
  const applied: TemplateApply = {};
  const name = template.defaultName?.trim();
  if (name) {
    applied.name = name;
  }
  const description = template.defaultDescription?.trim();
  if (description) {
    applied.description = description;
  }
  if (typeof template.defaultQuantity === "number" && Number.isFinite(template.defaultQuantity)) {
    applied.quantity = template.defaultQuantity;
  }
  if (typeof template.defaultInsured === "boolean") {
    applied.insured = template.defaultInsured;
  }
  const tags = (template.defaultTags ?? []).map(tag => tag.id?.trim() ?? "").filter(Boolean);
  if (tags.length > 0) {
    applied.tagIds = tags;
  }
  const manufacturer = template.defaultManufacturer?.trim();
  if (manufacturer) {
    applied.manufacturer = manufacturer;
  }
  const modelNumber = template.defaultModelNumber?.trim();
  if (modelNumber) {
    applied.modelNumber = modelNumber;
  }
  if (!options.keepLocation) {
    const locationId = template.defaultLocation?.id?.trim();
    if (locationId) {
      applied.locationId = locationId;
    }
  }
  return applied;
}

export type LocationChoice = {
  locationId: string | null;
  source: "explicit" | "template" | "none";
  rejectedExplicit: boolean;
};

/**
 * Explicit contextual destination wins. A template location is used only when
 * it is a real location in the signed-in collection and nothing explicit won.
 * Neither path invents the first shelf.
 */
export function chooseFilingLocation(args: {
  explicitDestinationId?: string | null;
  templateLocationId?: string | null;
  knownLocationIds: ReadonlyArray<string> | ReadonlySet<string>;
  collectionId?: string | null;
  currentCollectionId?: string | null;
}): LocationChoice {
  const explicit = explicitCreateLocationId({
    destinationId: args.explicitDestinationId,
    collectionId: args.collectionId,
    currentCollectionId: args.currentCollectionId,
    knownLocationIds: args.knownLocationIds,
  });
  if (explicit) {
    return { locationId: explicit, source: "explicit", rejectedExplicit: false };
  }

  const requested = args.explicitDestinationId?.trim();
  const rejectedExplicit = Boolean(requested);
  if (rejectedExplicit) {
    return { locationId: null, source: "none", rejectedExplicit: true };
  }

  const template = explicitCreateLocationId({
    destinationId: args.templateLocationId,
    knownLocationIds: args.knownLocationIds,
  });
  if (template) {
    return { locationId: template, source: "template", rejectedExplicit: false };
  }
  return { locationId: null, source: "none", rejectedExplicit: false };
}

export type LocationRowState = "loading" | "ready" | "missing" | "rejected" | "error";

export function locationRowState(args: {
  status: "loading" | "ready" | "error";
  requestedId: string | null;
  confirmedId: string | null;
}): LocationRowState {
  if (args.status === "loading") {
    return "loading";
  }
  if (args.status === "error") {
    return "error";
  }
  if (args.confirmedId) {
    return "ready";
  }
  if (args.requestedId) {
    return "rejected";
  }
  return "missing";
}

export type LocationSummaryLike = {
  id: string;
  name?: string | null;
  parent?: { id?: string | null; name?: string | null } | null;
};

/** Walk the loaded location list. Stops on a cycle. Does not invent names. */
export function locationChain(id: string, locations: LocationSummaryLike[]): Array<{ id: string; name: string }> {
  const byId = new Map(locations.map(location => [location.id, location]));
  const chain: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current) && chain.length < 64) {
    seen.add(current);
    const row = byId.get(current);
    if (!row) {
      break;
    }
    chain.push({ id: row.id, name: row.name?.trim() || row.id });
    current = row.parent?.id?.trim() || null;
  }
  return chain.reverse();
}

export type ShelfPreviewPhase = "absent" | "loading" | "empty" | "ready" | "error";

export function shelfPreviewPhase(args: {
  locationId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  count: number;
}): ShelfPreviewPhase {
  if (!args.locationId) {
    return "absent";
  }
  if (args.status === "idle" || args.status === "loading") {
    return "loading";
  }
  if (args.status === "error") {
    return "error";
  }
  return args.count === 0 ? "empty" : "ready";
}

export function shouldApplyShelfPreview(
  token: number,
  currentToken: number,
  requestedId: string,
  locationId: string
): boolean {
  return token === currentToken && requestedId === locationId;
}

export type ShelfItemLike = {
  id?: string | null;
  name?: string | null;
  purchasePrice?: unknown;
  imageId?: string | null;
  thumbnailId?: string | null;
  parent?: { id?: string | null } | null;
  entityType?: { isLocation?: boolean | null } | null;
};

export type ShelfRow = {
  id: string;
  name: string;
  purchasePrice: number | null;
  imageId: string | null;
  thumbnailId: string | null;
};

/**
 * Direct belongings on the selected shelf. Nested places are not listed as
 * items. A missing price stays missing — zero is a real price, not a blank.
 */
export function shelfRows(items: ShelfItemLike[], locationId: string): ShelfRow[] {
  const rows: ShelfRow[] = [];
  for (const item of items) {
    const id = item.id?.trim();
    if (!id || item.entityType?.isLocation === true) {
      continue;
    }
    const parentId = item.parent?.id?.trim();
    if (parentId && parentId !== locationId) {
      continue;
    }
    rows.push({
      id,
      name: item.name?.trim() || id,
      purchasePrice: knownAmount(item.purchasePrice),
      imageId: item.imageId?.trim() || null,
      thumbnailId: item.thumbnailId?.trim() || null,
    });
  }
  return rows;
}

export type PurchaseParse = { ok: true; value: number | undefined } | { ok: false; reason: "invalid" };

/** Blank omits the field. A currency sign or thousands separator is allowed. */
export function parsePurchasePriceInput(raw: string): PurchaseParse {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: undefined };
  }
  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return { ok: false, reason: "invalid" };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, value };
}

export function parseQuantityInput(
  value: number | string | null | undefined
): { ok: true; value: number } | { ok: false } {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? { ok: true, value } : { ok: false };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

function runeLength(value: string): number {
  return [...value].length;
}

export type CreatePayload =
  | { ok: true; kind: "item"; body: EntityCreate }
  | { ok: true; kind: "template"; templateId: string; body: EntityTemplateCreateItemRequest }
  | {
      ok: false;
      reason:
        | "missing-type"
        | "missing-location"
        | "missing-name"
        | "name-too-long"
        | "description-too-long"
        | "invalid-price"
        | "invalid-quantity"
        | "purchase-from-too-long";
    };

export type CreatePayloadInput = {
  name: string;
  description: string;
  quantity: number | string | null;
  purchasePrice?: string;
  purchaseFrom?: string;
  /** Undefined omits the field, so existing dialog clients keep column defaults. */
  insured?: boolean;
  tagIds: string[];
  locationId: string;
  entityTypeId: string;
  manufacturer?: string;
  modelNumber?: string;
  parentId?: string;
  templateId?: string | null;
  knownTagIds?: ReadonlySet<string> | ReadonlyArray<string>;
};

function knownTags(ids: string[], known?: ReadonlySet<string> | ReadonlyArray<string>): string[] {
  if (!known) {
    return ids;
  }
  const allowed = known instanceof Set ? known : new Set(known);
  return ids.filter(id => allowed.has(id));
}

export function buildCreateRequest(input: CreatePayloadInput): CreatePayload {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, reason: "missing-name" };
  }
  if (runeLength(name) > MAX_NAME) {
    return { ok: false, reason: "name-too-long" };
  }
  const description = input.description ?? "";
  if (runeLength(description) > MAX_DESCRIPTION) {
    return { ok: false, reason: "description-too-long" };
  }
  if (!input.entityTypeId) {
    return { ok: false, reason: "missing-type" };
  }
  const parentId = input.parentId?.trim() || input.locationId.trim();
  if (!parentId) {
    return { ok: false, reason: "missing-location" };
  }
  const quantity = parseQuantityInput(input.quantity);
  if (!quantity.ok) {
    return { ok: false, reason: "invalid-quantity" };
  }
  const price = parsePurchasePriceInput(input.purchasePrice ?? "");
  if (!price.ok) {
    return { ok: false, reason: "invalid-price" };
  }
  const purchaseFrom = input.purchaseFrom?.trim() ?? "";
  if (runeLength(purchaseFrom) > MAX_PURCHASE_FROM) {
    return { ok: false, reason: "purchase-from-too-long" };
  }

  const tagIds = knownTags(input.tagIds, input.knownTagIds);
  const shared = {
    name,
    description,
    parentId,
    quantity: quantity.value,
    tagIds,
    entityTypeId: input.entityTypeId,
  };

  if (input.templateId) {
    const body: EntityTemplateCreateItemRequest = { ...shared };
    if (price.value !== undefined) {
      body.purchasePrice = price.value;
    }
    if (purchaseFrom) {
      body.purchaseFrom = purchaseFrom;
    }
    if (typeof input.insured === "boolean") {
      body.insured = input.insured;
    }
    return { ok: true, kind: "template", templateId: input.templateId, body };
  }

  const body: EntityCreate = { ...shared };
  if (input.manufacturer !== undefined) {
    body.manufacturer = input.manufacturer;
  }
  if (input.modelNumber !== undefined) {
    body.modelNumber = input.modelNumber;
  }
  if (price.value !== undefined) {
    body.purchasePrice = price.value;
  }
  if (purchaseFrom) {
    body.purchaseFrom = purchaseFrom;
  }
  if (typeof input.insured === "boolean") {
    body.insured = input.insured;
  }
  return { ok: true, kind: "item", body };
}

/** A known in-app page. Never a caller-supplied return URL. */
export const SAFE_CREATE_EXIT = "/home";

export type CreateExit = {
  kind: "location" | "item" | "home";
  href: string;
};

function asKnownLocation(id: string | null | undefined, known: ReadonlySet<InventoryId>): InventoryId | null {
  const parsed = parseInventoryId(id);
  if (!parsed || !known.has(parsed)) {
    return null;
  }
  return parsed;
}

function knownLocationSet(ids: ReadonlyArray<string> | ReadonlySet<string>): Set<InventoryId> {
  const known = new Set<InventoryId>();
  for (const id of ids) {
    const parsed = parseInventoryId(id);
    if (parsed) {
      known.add(parsed);
    }
  }
  return known;
}

/**
 * Where Save or Cancel may go. Only validated location ids become a location
 * page. Cancel without one goes home. Save without one opens the created item.
 * A filing place outside the originating room is not written into that room's
 * address — the create request already names the real parent.
 */
export function resolveCreateExit(args: {
  intent: "cancel" | "save";
  createdId?: string | null;
  context: {
    collectionId?: string | null;
    rootLocationId?: string | null;
    branchId?: string | null;
    destinationId?: string | null;
    sourceItemId?: string | null;
  };
  knownLocationIds: ReadonlyArray<string> | ReadonlySet<string>;
  currentCollectionId?: string | null;
  /** The shelf actually saved, when it still sits in the originating room. */
  reportedDestinationId?: string | null;
  locations?: LocationSummaryLike[];
}): CreateExit {
  const known = knownLocationSet(args.knownLocationIds);
  const currentCollection = parseInventoryId(args.currentCollectionId);
  const contextCollection = parseInventoryId(args.context.collectionId);
  const collectionOk = !contextCollection || !currentCollection || contextCollection === currentCollection;
  const created = parseInventoryId(args.createdId);

  if (!collectionOk) {
    if (args.intent === "save" && created) {
      return { kind: "item", href: `/item/${created}` };
    }
    return { kind: "home", href: SAFE_CREATE_EXIT };
  }

  const root = asKnownLocation(args.context.rootLocationId, known);
  const branch = asKnownLocation(args.context.branchId, known);
  const hintedDestination = asKnownLocation(args.context.destinationId, known);
  const pageId = root ?? branch;

  if (pageId) {
    let destination = hintedDestination;
    const reported = asKnownLocation(args.reportedDestinationId, known);
    if (reported && args.locations) {
      const chain = locationChain(reported, args.locations);
      const inOrigin = reported === pageId || chain.some(part => part.id === pageId);
      if (inOrigin) {
        destination = reported;
      }
    }

    const context: InventoryContext = {};
    const collection = currentCollection ?? contextCollection;
    if (collection) {
      context.collectionId = collection;
    }
    context.rootLocationId = root ?? pageId;
    if (branch && branch !== context.rootLocationId) {
      context.branchId = branch;
    }
    if (destination) {
      context.destinationId = destination;
    }
    const source = parseInventoryId(args.context.sourceItemId);
    if (source) {
      context.sourceItemId = source;
    }
    const href = inventoryDestinationHref({ kind: "location", rootLocationId: pageId }, context);
    if (href?.startsWith("/location/")) {
      return { kind: "location", href };
    }
  }

  if (args.intent === "save" && created) {
    return { kind: "item", href: `/item/${created}` };
  }
  return { kind: "home", href: SAFE_CREATE_EXIT };
}

export type CreateResultClass = { kind: "created"; id: string } | { kind: "rejected" } | { kind: "uncertain" };

/**
 * A missing response, a gateway error, or a success without an id is not a
 * safe retry. A 4xx is a definite rejection and may be corrected and sent again.
 */
export function classifyCreateResult(input: {
  thrown?: boolean;
  status?: number | null;
  id?: unknown;
}): CreateResultClass {
  if (input.thrown || input.status == null || !Number.isFinite(input.status) || input.status <= 0) {
    return { kind: "uncertain" };
  }
  if (input.status >= 200 && input.status < 300) {
    const id = typeof input.id === "string" ? parseInventoryId(input.id) : null;
    return id ? { kind: "created", id } : { kind: "uncertain" };
  }
  if (input.status === 408 || input.status >= 500) {
    return { kind: "uncertain" };
  }
  return { kind: "rejected" };
}

export type SavePhase = "idle" | "saving" | "rejected" | "uncertain" | "saved" | "stale";

export type SaveSession = {
  phase: SavePhase;
  draftCleared: boolean;
};

/** One in-flight create. Uncertain and completed sessions cannot start another. */
export function startSave(session: SaveSession): SaveSession | null {
  if (session.phase === "saving" || session.phase === "uncertain" || session.phase === "saved") {
    return null;
  }
  return { phase: "saving", draftCleared: session.draftCleared };
}

export function settleSave(session: SaveSession, result: "created" | "rejected" | "uncertain" | "stale"): SaveSession {
  if (session.phase !== "saving") {
    return session;
  }
  if (result === "created") {
    return { phase: "saved", draftCleared: true };
  }
  if (result === "uncertain") {
    return { phase: "uncertain", draftCleared: false };
  }
  if (result === "stale") {
    return { phase: "stale", draftCleared: session.draftCleared };
  }
  return { phase: "rejected", draftCleared: false };
}

/** True only the first time a successful session asks to clear the draft. */
export function consumeDraftClear(session: SaveSession, alreadyConsumed: boolean): boolean {
  return session.phase === "saved" && session.draftCleared && !alreadyConsumed;
}

export function serverCreateDetail(data: unknown): { message: string; fields: Record<string, string> } {
  if (!data || typeof data !== "object") {
    return { message: "", fields: {} };
  }
  const record = data as Record<string, unknown>;
  const message = typeof record.error === "string" ? record.error.trim() : "";
  const fields: Record<string, string> = {};
  const raw = record.fields;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && value.trim()) {
        fields[key] = value.trim();
      }
    }
  }
  return { message, fields };
}

/**
 * Drop ids that cannot be written in the collection now on screen.
 * Tags are dropped entirely until that collection's tag list is ready.
 */
export function compatibleCreateIds(args: {
  locationId?: string | null;
  templateId?: string | null;
  entityTypeId?: string | null;
  tagIds: string[];
  knownLocationIds: ReadonlyArray<string> | ReadonlySet<string>;
  knownTagIds?: ReadonlyArray<string> | ReadonlySet<string> | null;
  knownTypeIds?: ReadonlyArray<string> | ReadonlySet<string> | null;
  knownTemplateIds?: ReadonlyArray<string> | ReadonlySet<string> | null;
}): {
  locationId: string | null;
  templateId: string | null;
  entityTypeId: string | null;
  tagIds: string[];
} {
  const locations = knownLocationSet(args.knownLocationIds);
  const allow = (
    id: string | null | undefined,
    known: ReadonlyArray<string> | ReadonlySet<string> | null | undefined
  ) => {
    const parsed = parseInventoryId(id);
    if (!parsed || !known) {
      return null;
    }
    const set = known instanceof Set ? known : new Set(known);
    return set.has(parsed) || set.has(id ?? "") ? parsed : null;
  };
  return {
    locationId: asKnownLocation(args.locationId, locations),
    templateId: allow(args.templateId, args.knownTemplateIds),
    entityTypeId: allow(args.entityTypeId, args.knownTypeIds),
    tagIds:
      args.knownTagIds == null
        ? []
        : args.tagIds.filter(id => {
            const parsed = parseInventoryId(id) ?? id;
            const set = args.knownTagIds instanceof Set ? args.knownTagIds : new Set(args.knownTagIds);
            return set.has(parsed) || set.has(id);
          }),
  };
}
