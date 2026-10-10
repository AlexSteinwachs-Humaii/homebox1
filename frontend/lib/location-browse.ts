/**
 * Room browsing for Purrfect Home.
 *
 * Location children come from the collection's location index, not from names
 * and not from EntityOut.children (those can be items). Item queries use the
 * existing direct-parent filter, so a shelf's belongings are loaded by passing
 * every location id in the selected subtree, then the item ids that can hold
 * further items. A page is never treated as the room total.
 */

export const LOCATION_BROWSE_PAGE_SIZE = 10;
export const LOCATION_PARENT_BATCH = 40;
export const LOCATION_BROWSE_MAX_DEPTH = 32;
export const LOCATION_BROWSE_MAX_PAGES = 100;

export type BrowseTag = {
  id: string;
  name: string;
};

export type BrowseRecord = {
  id: string;
  name: string;
  parentId: string | null;
  quantity: number | null;
  purchasePrice: number | null;
  tags: BrowseTag[];
  imageId: string | null;
  thumbnailId: string | null;
};

export type LocationRef = {
  id: string;
  name: string;
  parentId: string | null;
};

export type ParentQuery = {
  parentIds: string[];
  nextPage: number;
  received: number;
  total: number | null;
  depth: number;
};

export type LocationWalk = {
  locationIds: string[];
  queue: ParentQuery[];
  loaded: BrowseRecord[];
  scheduled: string[];
  status: "complete" | "partial" | "error";
  paused: boolean;
  depthLimited: boolean;
  pageLimited: boolean;
};

type SummaryLike = {
  id?: string | null;
  name?: string | null;
  parent?: { id?: string | null } | null;
  entityType?: { isLocation?: boolean | null } | null;
  quantity?: unknown;
  purchasePrice?: unknown;
  tags?: Array<{ id?: string | null; name?: string | null }> | null;
  imageId?: string | null;
  thumbnailId?: string | null;
};

type RouteChild = {
  id?: string | null;
  name?: string | null;
  entityType?: { isLocation?: boolean | null } | null;
};

export function knownQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

export function knownPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function formatQuantityValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

export function browseRecordFromSummary(item: SummaryLike): BrowseRecord | null {
  const id = item.id?.trim();
  if (!id) {
    return null;
  }
  const tags: BrowseTag[] = [];
  for (const tag of item.tags ?? []) {
    const tagId = tag.id?.trim();
    const name = tag.name?.trim();
    if (!tagId || !name) {
      continue;
    }
    tags.push({ id: tagId, name });
  }
  return {
    id,
    name: item.name?.trim() || id,
    parentId: item.parent?.id?.trim() || null,
    quantity: knownQuantity(item.quantity),
    purchasePrice: knownPrice(item.purchasePrice),
    tags,
    imageId: item.imageId?.trim() || null,
    thumbnailId: item.thumbnailId?.trim() || null,
  };
}

export function locationRefs(summaries: SummaryLike[]): LocationRef[] {
  const refs: LocationRef[] = [];
  const seen = new Set<string>();
  for (const summary of summaries) {
    if (summary.entityType?.isLocation !== true) {
      continue;
    }
    const id = summary.id?.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    refs.push({
      id,
      name: summary.name?.trim() || id,
      parentId: summary.parent?.id?.trim() || null,
    });
  }
  return refs;
}

export function withRouteLocation(
  refs: LocationRef[],
  route: { id: string; name: string; parentId: string | null }
): LocationRef[] {
  if (refs.some(ref => ref.id === route.id)) {
    return refs;
  }
  return [...refs, { id: route.id, name: route.name.trim() || route.id, parentId: route.parentId }];
}

function byNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  if (byName !== 0) {
    return byName;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Direct places inside a room. Item children on the location payload are not
 * places, even when the location index has not loaded them as locations.
 */
export function directLocationChildren(
  parentId: string,
  refs: LocationRef[],
  routeChildren: RouteChild[] = []
): LocationRef[] {
  const byId = new Map(refs.map(ref => [ref.id, ref]));
  const found = new Map<string, LocationRef>();

  for (const ref of refs) {
    if (ref.parentId === parentId) {
      found.set(ref.id, ref);
    }
  }

  for (const child of routeChildren) {
    const id = child.id?.trim();
    if (!id) {
      continue;
    }
    const indexed = byId.get(id);
    const markedLocation = child.entityType?.isLocation === true;
    if (!indexed && !markedLocation) {
      continue;
    }
    if (child.entityType?.isLocation === false) {
      continue;
    }
    found.set(id, {
      id,
      name: child.name?.trim() || indexed?.name || id,
      parentId,
    });
  }

  return [...found.values()].sort(byNameThenId);
}

export function subtreeLocationIds(rootId: string, refs: LocationRef[]): string[] {
  const children = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref.parentId) {
      continue;
    }
    const list = children.get(ref.parentId) ?? [];
    list.push(ref.id);
    children.set(ref.parentId, list);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
    const nested = children.get(id) ?? [];
    for (let i = nested.length - 1; i >= 0; i -= 1) {
      const childId = nested[i];
      if (childId) {
        stack.push(childId);
      }
    }
  }
  return out;
}

/** A selected id counts only when it is a real direct place. Never the first child. */
export function activePlaceId(selected: string | null | undefined, childIds: string[]): string | null {
  if (!selected) {
    return null;
  }
  return childIds.includes(selected) ? selected : null;
}

export function ancestorLocations(locationId: string, refs: LocationRef[]): LocationRef[] {
  const byId = new Map(refs.map(ref => [ref.id, ref]));
  const chain: LocationRef[] = [];
  const seen = new Set<string>();
  let current = byId.get(locationId)?.parentId ?? null;
  while (current && !seen.has(current) && chain.length < LOCATION_BROWSE_MAX_DEPTH) {
    seen.add(current);
    const node = byId.get(current);
    if (!node) {
      break;
    }
    chain.push(node);
    current = node.parentId;
  }
  return chain.reverse();
}

function uniqueIds(ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function batches(ids: string[]): string[][] {
  const unique = uniqueIds(ids);
  const out: string[][] = [];
  for (let i = 0; i < unique.length; i += LOCATION_PARENT_BATCH) {
    out.push(unique.slice(i, i + LOCATION_PARENT_BATCH));
  }
  return out;
}

export function createLocationWalk(locationIds: string[]): LocationWalk {
  const ids = uniqueIds(locationIds);
  if (ids.length === 0) {
    return {
      locationIds: [],
      queue: [],
      loaded: [],
      scheduled: [],
      status: "complete",
      paused: false,
      depthLimited: false,
      pageLimited: false,
    };
  }
  return {
    locationIds: ids,
    queue: batches(ids).map(parentIds => ({
      parentIds,
      nextPage: 1,
      received: 0,
      total: null,
      depth: 0,
    })),
    loaded: [],
    scheduled: ids,
    status: "partial",
    paused: false,
    depthLimited: false,
    pageLimited: false,
  };
}

export function continueLocationWalk(walk: LocationWalk): LocationWalk {
  if (walk.status === "complete" || walk.status === "error" || walk.depthLimited || walk.pageLimited) {
    return walk;
  }
  return { ...walk, paused: false };
}

export function nextLocationQuery(walk: LocationWalk): { parentIds: string[]; page: number; pageSize: number } | null {
  if (walk.paused || walk.status === "complete" || walk.status === "error" || walk.queue.length === 0) {
    return null;
  }
  const head = walk.queue[0];
  if (!head || head.parentIds.length === 0) {
    return null;
  }
  return { parentIds: head.parentIds, page: head.nextPage, pageSize: LOCATION_BROWSE_PAGE_SIZE };
}

function mergeRecords(existing: BrowseRecord[], incoming: BrowseRecord[]): BrowseRecord[] {
  const seen = new Set(existing.map(item => item.id));
  const out = existing.slice();
  for (const item of incoming) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function queryFinished(received: number, total: number): boolean {
  return received >= total;
}

export function reduceLocationWalk(
  walk: LocationWalk,
  page: { items: BrowseRecord[]; total: number; page: number; pageSize: number }
): LocationWalk {
  if (walk.status === "complete" || walk.status === "error" || walk.queue.length === 0) {
    return walk;
  }
  const head = walk.queue[0];
  if (!head || page.page !== head.nextPage) {
    return { ...walk, status: "error", paused: true };
  }
  if (!Number.isFinite(page.total) || page.total < 0) {
    return { ...walk, status: "error", paused: true };
  }

  const received = head.received + page.items.length;
  if (page.items.length === 0 && received < page.total) {
    return { ...walk, status: "error", paused: true };
  }

  const loaded = mergeRecords(walk.loaded, page.items);
  const finished = queryFinished(received, page.total);

  if (!finished) {
    if (head.nextPage >= LOCATION_BROWSE_MAX_PAGES) {
      return {
        ...walk,
        loaded,
        status: "partial",
        paused: true,
        pageLimited: true,
      };
    }
    const queue = [{ ...head, nextPage: head.nextPage + 1, received, total: page.total }, ...walk.queue.slice(1)];
    return { ...walk, queue, loaded, status: "partial", paused: true };
  }

  let queue = walk.queue.slice(1);
  let scheduled = walk.scheduled;
  let depthLimited = walk.depthLimited;
  const scheduledSet = new Set(scheduled);
  const freshIds = loaded.map(item => item.id).filter(id => !scheduledSet.has(id));
  if (freshIds.length > 0) {
    const depth = head.depth + 1;
    if (depth > LOCATION_BROWSE_MAX_DEPTH) {
      depthLimited = true;
    } else {
      queue = [
        ...queue,
        ...batches(freshIds).map(parentIds => ({
          parentIds,
          nextPage: 1,
          received: 0,
          total: null,
          depth,
        })),
      ];
      scheduled = [...scheduled, ...uniqueIds(freshIds)];
    }
  }

  if (depthLimited && queue.length === 0) {
    return { ...walk, queue, loaded, scheduled, status: "partial", paused: true, depthLimited: true };
  }
  if (queue.length === 0) {
    return { ...walk, queue, loaded, scheduled, status: "complete", paused: false, depthLimited };
  }
  return { ...walk, queue, loaded, scheduled, status: "partial", paused: false, depthLimited };
}

export function walkIsComplete(walk: LocationWalk): boolean {
  return walk.status === "complete" && !walk.depthLimited && !walk.pageLimited;
}

/** Record count is the loaded set only after every page and nested container has been read. */
export function visibleRecordCount(walk: LocationWalk): number | null {
  if (!walkIsComplete(walk)) {
    return null;
  }
  return walk.loaded.length;
}

/** Quantity sum is separate from the record count and is withheld while a page is missing. */
export function visibleQuantitySum(walk: LocationWalk): number | null {
  if (!walkIsComplete(walk)) {
    return null;
  }
  let sum = 0;
  for (const item of walk.loaded) {
    if (item.quantity == null) {
      return null;
    }
    sum += item.quantity;
  }
  return sum;
}

type ChainNode = {
  id: string;
  name: string;
  parentId: string | null;
  kind: "location" | "item";
};

function buildNodes(locations: LocationRef[], items: BrowseRecord[]): Map<string, ChainNode> {
  const nodes = new Map<string, ChainNode>();
  for (const location of locations) {
    nodes.set(location.id, {
      id: location.id,
      name: location.name,
      parentId: location.parentId,
      kind: "location",
    });
  }
  for (const item of items) {
    if (nodes.has(item.id)) {
      continue;
    }
    nodes.set(item.id, {
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      kind: "item",
    });
  }
  return nodes;
}

export function containingLocationId(itemId: string, locations: LocationRef[], items: BrowseRecord[]): string | null {
  const nodes = buildNodes(locations, items);
  const seen = new Set<string>();
  let current = nodes.get(itemId)?.parentId ?? null;
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = nodes.get(current);
    if (!node) {
      return null;
    }
    if (node.kind === "location") {
      return node.id;
    }
    current = node.parentId;
  }
  return null;
}

export type ShelfGroup = {
  id: string;
  label: string;
  items: Array<
    BrowseRecord & {
      placeLabel: string;
    }
  >;
};

const PLACE_SEPARATOR = " · ";

/**
 * Group by the location path under the selected place. Item containers stay in
 * the row label; they do not become shelves.
 */
export function groupBelongings(
  items: BrowseRecord[],
  locations: LocationRef[],
  scopeId: string,
  anchors: BrowseRecord[] = []
): ShelfGroup[] {
  const chained = anchors.length > 0 ? [...anchors, ...items] : items;
  const nodes = buildNodes(locations, chained);
  const scope = nodes.get(scopeId);
  const scopeIds = new Set(subtreeLocationIds(scopeId, locations));
  const groups = new Map<string, ShelfGroup>();

  for (const item of items) {
    const located = containingLocationId(item.id, locations, chained);
    if (located && !scopeIds.has(located)) {
      continue;
    }
    const chain: ChainNode[] = [];
    const seen = new Set<string>([item.id]);
    let current = item.parentId;
    let reachedScope = item.id === scopeId;
    while (current && !seen.has(current) && chain.length < LOCATION_BROWSE_MAX_DEPTH) {
      seen.add(current);
      const node = nodes.get(current);
      if (!node) {
        break;
      }
      chain.push(node);
      if (node.id === scopeId) {
        reachedScope = true;
        break;
      }
      current = node.parentId;
    }
    chain.reverse();

    if (!reachedScope && located && located !== scopeId) {
      continue;
    }
    const belowScope = reachedScope ? chain.filter(node => node.id !== scopeId) : chain;
    const locationNodes = belowScope.filter(node => node.kind === "location");
    const groupNodes = locationNodes.length > 0 ? locationNodes : scope && reachedScope ? [scope] : [];
    const groupId = groupNodes.length > 0 ? groupNodes.map(node => node.id).join("/") : "unplaced";
    const groupLabel =
      locationNodes.length > 0
        ? locationNodes.map(node => node.name).join(PLACE_SEPARATOR)
        : scope && reachedScope
          ? scope.name
          : "";
    const placeNodes = belowScope.length > 0 ? belowScope : scope && reachedScope ? [scope] : [];
    const placeLabel = placeNodes.map(node => node.name).join(PLACE_SEPARATOR);

    const row = { ...item, placeLabel };
    const existing = groups.get(groupId);
    if (existing) {
      existing.items.push(row);
    } else {
      groups.set(groupId, { id: groupId, label: groupLabel, items: [row] });
    }
  }

  const sorted = [...groups.values()].sort((a, b) =>
    byNameThenId({ name: a.label, id: a.id }, { name: b.label, id: b.id })
  );
  for (const group of sorted) {
    group.items.sort((a, b) => {
      const byPlace = a.placeLabel.localeCompare(b.placeLabel, undefined, { sensitivity: "base", numeric: true });
      if (byPlace !== 0) {
        return byPlace;
      }
      return byNameThenId(a, b);
    });
  }
  return sorted;
}

export function childRecordCounts(
  items: BrowseRecord[],
  children: LocationRef[],
  locations: LocationRef[]
): Map<string, number> {
  const counts = new Map(children.map(child => [child.id, 0]));
  const subtrees = new Map(children.map(child => [child.id, new Set(subtreeLocationIds(child.id, locations))]));
  for (const item of items) {
    const locationId = containingLocationId(item.id, locations, items);
    if (!locationId) {
      continue;
    }
    for (const child of children) {
      if (subtrees.get(child.id)?.has(locationId)) {
        counts.set(child.id, (counts.get(child.id) ?? 0) + 1);
      }
    }
  }
  return counts;
}
