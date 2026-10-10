/**
 * Shared inventory navigation contract for Design C.
 *
 * IDs are hints for later screens to check against the signed-in collection's
 * own API data. They are not authorization, and this module never switches
 * the active collection or follows a caller-supplied return URL.
 *
 * Enhancement six switches only the Purrfect Home launcher onto `/item/add`
 * by setting `PURRFECT_CONTEXTUAL_ADD_PATH`. Until that route exists, every
 * theme keeps the existing item creation dialog.
 */

export const PURRFECT_DESKTOP_MIN_WIDTH_PX = 1024;
export const PURRFECT_DESKTOP_MEDIA_QUERY = `(min-width: ${PURRFECT_DESKTOP_MIN_WIDTH_PX}px)`;

/** Null until enhancement six supplies the Purrfect contextual add page. */
export const PURRFECT_CONTEXTUAL_ADD_PATH: "/item/add" | null = null;

export const INVENTORY_CONTEXT_QUERY_KEYS = {
  collectionId: "collectionId",
  rootLocationId: "rootLocationId",
  branchId: "branchId",
  destinationId: "destinationId",
  sourceItemId: "sourceItemId",
} as const;

export type InventoryContextKey = keyof typeof INVENTORY_CONTEXT_QUERY_KEYS;

const REJECTED_RETURN_URL_KEYS = new Set([
  "return",
  "returnurl",
  "returnto",
  "redirect",
  "redirectto",
  "next",
  "url",
  "continue",
  "goto",
  "dest",
]);

const COLLECTION_TABS = ["members", "invites", "notifiers", "settings", "entity-types", "tools"] as const;

export type CollectionTab = (typeof COLLECTION_TABS)[number];

declare const inventoryIdBrand: unique symbol;

/** A UUID that names a record. Not proof the caller may read it. */
export type InventoryId = string & { readonly [inventoryIdBrand]: true };

export type InventoryContext = {
  collectionId?: InventoryId;
  rootLocationId?: InventoryId;
  branchId?: InventoryId;
  destinationId?: InventoryId;
  sourceItemId?: InventoryId;
};

export type InventoryDestination =
  | { kind: "home" }
  | { kind: "items"; query?: string }
  | { kind: "locations" }
  | { kind: "location"; rootLocationId: InventoryId }
  | { kind: "location-edit"; rootLocationId: InventoryId }
  | { kind: "item"; itemId: InventoryId }
  | { kind: "item-edit"; itemId: InventoryId }
  | { kind: "item-add" }
  | { kind: "tags" }
  | { kind: "tag"; tagId: InventoryId }
  | { kind: "templates" }
  | { kind: "template"; templateId: InventoryId }
  | { kind: "maintenance" }
  | { kind: "collection"; tab: CollectionTab }
  | { kind: "profile" }
  | { kind: "scanner" };

export type InventoryContextRejection =
  | "invalid-id"
  | "incompatible-collection"
  | "arbitrary-return-url"
  | "external-destination"
  | "unknown-destination"
  | "malformed";

export type InventoryNavigation = {
  destination: InventoryDestination;
  context: InventoryContext;
};

export type InventoryNavigationResult =
  { ok: true; navigation: InventoryNavigation } | { ok: false; reason: InventoryContextRejection };

export type AddItemLaunch =
  { mode: "dialog"; reason?: InventoryContextRejection } | { mode: "page"; href: string; context: InventoryContext };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const LOCAL_ORIGIN = "http://homebox.local";

const CONTEXT_KEYS = Object.keys(INVENTORY_CONTEXT_QUERY_KEYS) as InventoryContextKey[];

export function parseInventoryId(value: unknown): InventoryId | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!UUID_RE.test(trimmed) || trimmed.toLowerCase() === NIL_UUID) {
    return null;
  }

  return trimmed.toLowerCase() as InventoryId;
}

export function emptyInventoryContext(): InventoryContext {
  return {};
}

/**
 * Never returns a collection to activate. Query input must not change the
 * signed-in collection; callers keep the collection they already have.
 */
export function collectionIdToActivate(): null {
  return null;
}

export function isCompatibleCollection(
  context: InventoryContext,
  currentCollectionId: string | null | undefined
): boolean {
  if (!context.collectionId || currentCollectionId == null || currentCollectionId === "") {
    return !context.collectionId;
  }

  const current = parseInventoryId(currentCollectionId);
  return current !== null && current === context.collectionId;
}

function paramsFromInput(input: string | URLSearchParams | Record<string, unknown>): URLSearchParams | null {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return new URLSearchParams();
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
      return null;
    }

    const query = trimmed.startsWith("?")
      ? trimmed.slice(1)
      : trimmed.includes("?")
        ? (trimmed.split("?")[1]?.split("#")[0] ?? "")
        : trimmed.includes("=")
          ? trimmed
          : "";

    if (!query && !trimmed.includes("=") && !trimmed.startsWith("?")) {
      return new URLSearchParams();
    }

    return new URLSearchParams(query);
  }

  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) {
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return null;
    }
    params.append(key, String(value));
  }
  return params;
}

function hasArbitraryReturnUrl(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    if (REJECTED_RETURN_URL_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function readContextIds(params: URLSearchParams): InventoryContext | InventoryContextRejection {
  const context: InventoryContext = {};

  for (const key of CONTEXT_KEYS) {
    const queryKey = INVENTORY_CONTEXT_QUERY_KEYS[key];
    const values = params.getAll(queryKey).filter(value => value !== "");
    if (values.length === 0) {
      continue;
    }
    if (values.length > 1) {
      return "malformed";
    }

    const id = parseInventoryId(values[0]);
    if (!id) {
      return "invalid-id";
    }
    context[key] = id;
  }

  return context;
}

export function readInventoryContext(
  input: string | URLSearchParams | Record<string, unknown>,
  options?: { currentCollectionId?: string | null }
): InventoryNavigationResult | { ok: true; navigation: { destination?: undefined; context: InventoryContext } } {
  const params = paramsFromInput(input);
  if (!params) {
    return { ok: false, reason: "external-destination" };
  }
  if (hasArbitraryReturnUrl(params)) {
    return { ok: false, reason: "arbitrary-return-url" };
  }

  const context = readContextIds(params);
  if (typeof context === "string") {
    return { ok: false, reason: context };
  }

  if (context.collectionId && options && "currentCollectionId" in options && options.currentCollectionId) {
    if (!isCompatibleCollection(context, options.currentCollectionId)) {
      return { ok: false, reason: "incompatible-collection" };
    }
  }

  return { ok: true, navigation: { context } };
}

function objectContextParams(context: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === "string" && value !== "") {
      params.append(key, value);
    } else if (value != null && typeof value !== "string") {
      params.append(key, "invalid");
    }
  }
  return params;
}

function hasUnsafePathText(value: string): boolean {
  if (value.includes("\\") || value.includes("\0")) {
    return true;
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function localUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) {
    return null;
  }
  if (hasUnsafePathText(trimmed) || trimmed.includes("..") || /%2e%2e/i.test(trimmed)) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    return null;
  }
  if (!trimmed.startsWith("/")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed, LOCAL_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== LOCAL_ORIGIN || url.username || url.password) {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (hasUnsafePathText(decodedPath) || decodedPath.split("/").includes("..")) {
    return null;
  }

  return url;
}

function destinationFromPath(pathname: string): InventoryDestination | InventoryContextRejection {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 1) {
    switch (parts[0]) {
      case "home":
        return { kind: "home" };
      case "items":
        return { kind: "items" };
      case "locations":
        return { kind: "locations" };
      case "tags":
        return { kind: "tags" };
      case "templates":
        return { kind: "templates" };
      case "maintenance":
        return { kind: "maintenance" };
      case "profile":
        return { kind: "profile" };
      case "collection":
        return { kind: "collection", tab: "members" };
      case "scanner-ar":
        return { kind: "scanner" };
      default:
        return "unknown-destination";
    }
  }

  if (parts.length === 2 && parts[0] === "item" && parts[1] === "add") {
    return { kind: "item-add" };
  }

  if (parts.length === 2 && parts[0] === "collection") {
    const tab = COLLECTION_TABS.find(candidate => candidate === parts[1]);
    return tab ? { kind: "collection", tab } : "unknown-destination";
  }

  const idRoutes: Record<string, InventoryDestination["kind"]> = {
    location: "location",
    item: "item",
    tag: "tag",
    template: "template",
  };

  if (parts.length === 2 || (parts.length === 3 && parts[2] === "edit")) {
    const kind = idRoutes[parts[0] ?? ""];
    if (!kind || parts[1] === "add") {
      return "unknown-destination";
    }
    const id = parseInventoryId(parts[1]);
    if (!id) {
      return "invalid-id";
    }
    if (parts.length === 3) {
      if (kind === "location") {
        return { kind: "location-edit", rootLocationId: id };
      }
      if (kind === "item") {
        return { kind: "item-edit", itemId: id };
      }
      return "unknown-destination";
    }
    if (kind === "location") {
      return { kind: "location", rootLocationId: id };
    }
    if (kind === "item") {
      return { kind: "item", itemId: id };
    }
    if (kind === "tag") {
      return { kind: "tag", tagId: id };
    }
    if (kind === "template") {
      return { kind: "template", templateId: id };
    }
  }

  return "unknown-destination";
}

function mergeContext(
  pathContext: InventoryContext,
  queryContext: InventoryContext
): InventoryContext | InventoryContextRejection {
  const merged: InventoryContext = { ...queryContext };

  if (pathContext.rootLocationId) {
    if (merged.rootLocationId && merged.rootLocationId !== pathContext.rootLocationId) {
      return "malformed";
    }
    merged.rootLocationId = pathContext.rootLocationId;
  }
  if (pathContext.sourceItemId) {
    if (merged.sourceItemId && merged.sourceItemId !== pathContext.sourceItemId) {
      return "malformed";
    }
    merged.sourceItemId = pathContext.sourceItemId;
  }

  return merged;
}

function contextFromDestination(destination: InventoryDestination): InventoryContext {
  switch (destination.kind) {
    case "location":
    case "location-edit":
      return { rootLocationId: destination.rootLocationId };
    case "item":
    case "item-edit":
      return { sourceItemId: destination.itemId };
    default:
      return {};
  }
}

export function parseInventoryDestination(input: string): InventoryNavigationResult {
  const url = localUrl(input);
  if (!url) {
    return {
      ok: false,
      reason: /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(input.trim()) ? "external-destination" : "malformed",
    };
  }
  if (hasArbitraryReturnUrl(url.searchParams)) {
    return { ok: false, reason: "arbitrary-return-url" };
  }

  const destination = destinationFromPath(url.pathname);
  if (typeof destination === "string") {
    return { ok: false, reason: destination };
  }

  const queryContext = readContextIds(url.searchParams);
  if (typeof queryContext === "string") {
    return { ok: false, reason: queryContext };
  }

  if (destination.kind === "items") {
    const query = url.searchParams.get("q") ?? undefined;
    destination.query = query === null ? undefined : query;
  }

  const context = mergeContext(contextFromDestination(destination), queryContext);
  if (typeof context === "string") {
    return { ok: false, reason: context };
  }

  return { ok: true, navigation: { destination, context } };
}

export function acceptInventoryNavigation(
  input: string | { destination: string; context?: string | URLSearchParams | Record<string, unknown> },
  options?: { currentCollectionId?: string | null }
): InventoryNavigationResult {
  const parsed =
    typeof input === "string" ? parseInventoryDestination(input) : parseInventoryDestination(input.destination);
  if (!parsed.ok) {
    return parsed;
  }

  let context = parsed.navigation.context;
  if (typeof input !== "string" && input.context) {
    const extra = readInventoryContext(input.context, options);
    if (!extra.ok) {
      return extra;
    }
    const merged = mergeContext(context, extra.navigation.context);
    if (typeof merged === "string") {
      return { ok: false, reason: merged };
    }
    context = merged;
  }

  if (
    context.collectionId &&
    options?.currentCollectionId &&
    !isCompatibleCollection(context, options.currentCollectionId)
  ) {
    return { ok: false, reason: "incompatible-collection" };
  }

  return { ok: true, navigation: { destination: parsed.navigation.destination, context } };
}

const MAX_LOCATION_ANCESTORS = 64;

export type ItemAncestorInput = {
  id?: string | null;
  name?: string | null;
  /** Ignored. The path API labels every ancestor, including items, as a location. */
  type?: string | null;
  parent?: ItemAncestorInput | null;
};

export type ClassifiedAncestor = {
  id: InventoryId;
  name: string;
  kind: "location" | "item" | "pending";
};

export type ItemLocationHandoff = {
  /** Empty when the item has no valid location, or the collection hint was discarded. */
  context: InventoryContext;
  /**
   * `/location/:rootId` plus the foundation id query.
   * Null when there is no containing location or the hint belongs to another collection.
   */
  href: string | null;
  ancestors: ClassifiedAncestor[];
  locationSegments: Array<{ id: InventoryId; name: string }>;
};

function sameInventoryId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function ancestorName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKnownLocationIds(ids: ReadonlySet<string> | null): Set<string> | null {
  if (ids === null) {
    return null;
  }
  const normalized = new Set<string>();
  for (const id of ids) {
    const parsed = parseInventoryId(id);
    if (parsed) {
      normalized.add(parsed);
    }
  }
  return normalized;
}

function parentChain(parent: ItemAncestorInput | null | undefined): ItemAncestorInput[] {
  const chain: ItemAncestorInput[] = [];
  const seen = new Set<string>();
  let current = parent ?? null;
  while (current && chain.length < MAX_LOCATION_ANCESTORS) {
    const marker = current.id?.trim() || ancestorName(current.name);
    if (marker && seen.has(marker.toLowerCase())) {
      break;
    }
    if (marker) {
      seen.add(marker.toLowerCase());
    }
    chain.push({ id: current.id, name: current.name });
    current = current.parent ?? null;
  }
  return chain.reverse();
}

function ancestorsWithoutSelf(
  itemId: string,
  path: readonly ItemAncestorInput[] | null | undefined
): ItemAncestorInput[] {
  if (!path || path.length === 0) {
    return [];
  }
  const trimmed = path.slice(0, MAX_LOCATION_ANCESTORS).filter(entry => {
    return !entry.id || !sameInventoryId(entry.id, itemId);
  });
  return trimmed;
}

function collectionsDisagree(
  requested: InventoryId | null,
  currentCollectionId: string | null | undefined,
  currentProvided: boolean
): boolean {
  if (!currentProvided) {
    return false;
  }
  if (currentCollectionId == null || currentCollectionId === "") {
    return false;
  }
  const current = parseInventoryId(currentCollectionId);
  if (!current) {
    return true;
  }
  return requested !== null && requested !== current;
}

/**
 * Item → location handoff.
 *
 * Root is the topmost actual location ancestor. Branch is the next location
 * below that root, when one exists. Destination is the nearest containing
 * location. Source is the item being viewed. Path `type` is never consulted.
 * The result is a hint for the location screen: it does not change inventory
 * and it does not switch the signed-in collection.
 */
export function deriveItemLocationHandoff(input: {
  itemId: string;
  collectionId?: string | null;
  currentCollectionId?: string | null;
  path?: readonly ItemAncestorInput[] | null;
  parent?: ItemAncestorInput | null;
  location?: ItemAncestorInput | null;
  /** null while this collection's locations have not loaded. An empty set is a loaded collection with none. */
  locationIds: ReadonlySet<string> | null;
}): ItemLocationHandoff {
  const requestedCollection = parseInventoryId(input.collectionId);
  const currentProvided = input.currentCollectionId !== undefined;
  const discardCollection = collectionsDisagree(requestedCollection, input.currentCollectionId, currentProvided);
  const sourceId = parseInventoryId(input.itemId);
  const knownIds = normalizeKnownLocationIds(input.locationIds);
  const statedLocationId = parseInventoryId(input.location?.id);
  const statedIsSelf = statedLocationId !== null && sourceId !== null && statedLocationId === sourceId;
  const statedIsListed = statedLocationId !== null && (knownIds === null || knownIds.has(statedLocationId));
  const trustedLocationId = statedIsSelf || !statedIsListed ? null : statedLocationId;

  const fromPath = ancestorsWithoutSelf(input.itemId, input.path);
  const rawAncestors = fromPath.length > 0 ? fromPath : parentChain(input.parent);
  const ancestors: ClassifiedAncestor[] = [];
  const seen = new Set<string>();

  for (const entry of rawAncestors) {
    const name = ancestorName(entry.name);
    const id = parseInventoryId(entry.id);
    if (!name || !id || seen.has(id) || sameInventoryId(id, input.itemId)) {
      continue;
    }
    seen.add(id);

    let kind: ClassifiedAncestor["kind"];
    if ((trustedLocationId !== null && id === trustedLocationId) || knownIds?.has(id)) {
      kind = "location";
    } else if (knownIds === null) {
      kind = "pending";
    } else {
      kind = "item";
    }
    ancestors.push({ id, name, kind });
  }

  const pathLocations = ancestors.filter(ancestor => ancestor.kind === "location");
  let locationSegments = pathLocations.map(ancestor => ({ id: ancestor.id, name: ancestor.name }));
  if (trustedLocationId && !seen.has(trustedLocationId)) {
    const name = ancestorName(input.location?.name);
    if (name) {
      locationSegments = [...locationSegments, { id: trustedLocationId, name }];
      ancestors.push({ id: trustedLocationId, name, kind: "location" });
      seen.add(trustedLocationId);
    }
  }

  const nearestPathLocation = pathLocations.at(-1)?.id ?? null;
  let navigationChain = locationSegments;
  if (trustedLocationId && nearestPathLocation && trustedLocationId !== nearestPathLocation) {
    const statedIndex = pathLocations.findIndex(ancestor => ancestor.id === trustedLocationId);
    if (statedIndex >= 0) {
      navigationChain = pathLocations.slice(0, statedIndex + 1).map(ancestor => ({
        id: ancestor.id,
        name: ancestor.name,
      }));
    } else {
      const stated = locationSegments.find(segment => segment.id === trustedLocationId);
      navigationChain = stated ? [stated] : [];
    }
  } else if (trustedLocationId && !nearestPathLocation) {
    const stated = locationSegments.find(segment => segment.id === trustedLocationId);
    navigationChain = stated ? [stated] : [];
  }

  const root = navigationChain[0]?.id ?? null;
  const destination = navigationChain.at(-1)?.id ?? null;
  const branch = navigationChain.length >= 2 ? (navigationChain[1]?.id ?? null) : null;
  const empty = emptyInventoryContext();

  if (discardCollection || !sourceId || !root || !destination) {
    return { context: empty, href: null, ancestors, locationSegments };
  }

  const context: InventoryContext = {
    rootLocationId: root,
    destinationId: destination,
    sourceItemId: sourceId,
  };
  if (branch && branch !== root) {
    context.branchId = branch;
  }
  const collectionForHref =
    requestedCollection ?? (currentProvided ? parseInventoryId(input.currentCollectionId) : null);
  if (collectionForHref && !discardCollection) {
    context.collectionId = collectionForHref;
  }

  return {
    context,
    href: inventoryDestinationHref({ kind: "location", rootLocationId: root }, context),
    ancestors,
    locationSegments,
  };
}

/**
 * Keep a location hint only when it belongs to the signed-in collection.
 * A rejected hint is not a destination to follow. `replacementHref` is the
 * same path with the hint removed, so the caller can drop it without writing
 * inventory.
 */
export function discardIncompatibleInventoryContext(
  href: string,
  currentCollectionId?: string | null
): { context: InventoryContext; replacementHref: string | null } {
  const accepted = acceptInventoryNavigation(href, { currentCollectionId });
  if (accepted.ok) {
    return { context: accepted.navigation.context, replacementHref: null };
  }

  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex < 0) {
    return { context: emptyInventoryContext(), replacementHref: null };
  }

  const path = withoutHash.slice(0, queryIndex);
  const params = new URLSearchParams(withoutHash.slice(queryIndex + 1));
  let removed = false;
  for (const key of [...params.keys()]) {
    const lower = key.toLowerCase();
    const isContext = (Object.values(INVENTORY_CONTEXT_QUERY_KEYS) as string[]).some(
      queryKey => queryKey.toLowerCase() === lower
    );
    if (isContext || REJECTED_RETURN_URL_KEYS.has(lower)) {
      params.delete(key);
      removed = true;
    }
  }

  if (!removed || !path.startsWith("/")) {
    return { context: emptyInventoryContext(), replacementHref: null };
  }

  const rest = params.toString();
  return {
    context: emptyInventoryContext(),
    replacementHref: rest ? `${path}?${rest}` : path,
  };
}

export function encodeInventoryContext(context: InventoryContext): string {
  const params = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value) {
      params.set(INVENTORY_CONTEXT_QUERY_KEYS[key], value);
    }
  }
  return params.toString();
}

export function inventoryDestinationHref(destination: InventoryDestination, context?: InventoryContext): string | null {
  let path: string;
  switch (destination.kind) {
    case "home":
      path = "/home";
      break;
    case "items":
      return destination.query ? itemsSearchHref(destination.query) : "/items";
    case "locations":
      path = "/locations";
      break;
    case "location":
      path = `/location/${destination.rootLocationId}`;
      break;
    case "location-edit":
      path = `/location/${destination.rootLocationId}/edit`;
      break;
    case "item":
      path = `/item/${destination.itemId}`;
      break;
    case "item-edit":
      path = `/item/${destination.itemId}/edit`;
      break;
    case "item-add":
      path = "/item/add";
      break;
    case "tags":
      path = "/tags";
      break;
    case "tag":
      path = `/tag/${destination.tagId}`;
      break;
    case "templates":
      path = "/templates";
      break;
    case "template":
      path = `/template/${destination.templateId}`;
      break;
    case "maintenance":
      path = "/maintenance";
      break;
    case "collection":
      path = `/collection/${destination.tab}`;
      break;
    case "profile":
      path = "/profile";
      break;
    case "scanner":
      path = "/scanner-ar";
      break;
    default:
      return null;
  }

  const query = context ? encodeInventoryContext(context) : "";
  return query ? `${path}?${query}` : path;
}

/**
 * Opens search in the current collection. The href is only `/items` plus an
 * encoded `q`; it never carries a collection id or a return URL.
 */
export function itemsSearchHref(query: string): string | null {
  if (!query) {
    return null;
  }
  return `/items?q=${encodeURIComponent(query)}`;
}

export function resolveAddItemLaunch(args: {
  theme: string;
  currentCollectionId?: string | null;
  context?: InventoryContext | string | URLSearchParams | Record<string, unknown> | null;
  contextualAddPath?: string | null;
}): AddItemLaunch {
  const contextualAddPath =
    args.contextualAddPath === undefined ? PURRFECT_CONTEXTUAL_ADD_PATH : args.contextualAddPath;
  const usePurrfectPage = args.theme === "purrfect-home" && contextualAddPath === "/item/add";

  if (!usePurrfectPage) {
    return { mode: "dialog" };
  }

  if (!args.context) {
    const current = args.currentCollectionId ? parseInventoryId(args.currentCollectionId) : null;
    const context = current ? { collectionId: current } : {};
    return {
      mode: "page",
      href: inventoryDestinationHref({ kind: "item-add" }, context) ?? "/item/add",
      context,
    };
  }

  const contextInput =
    typeof args.context === "string" || args.context instanceof URLSearchParams
      ? args.context
      : objectContextParams(args.context);
  const accepted = readInventoryContext(contextInput, {
    currentCollectionId: args.currentCollectionId,
  });

  if (!accepted.ok) {
    return { mode: "dialog", reason: accepted.reason };
  }

  if (
    accepted.navigation.context.collectionId &&
    args.currentCollectionId &&
    !isCompatibleCollection(accepted.navigation.context, args.currentCollectionId)
  ) {
    return { mode: "dialog", reason: "incompatible-collection" };
  }

  const context = { ...accepted.navigation.context };
  if (!context.collectionId && args.currentCollectionId) {
    const current = parseInventoryId(args.currentCollectionId);
    if (current) {
      context.collectionId = current;
    }
  }

  return {
    mode: "page",
    href: inventoryDestinationHref({ kind: "item-add" }, context) ?? "/item/add",
    context,
  };
}
