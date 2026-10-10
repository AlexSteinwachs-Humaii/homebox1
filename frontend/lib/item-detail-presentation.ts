/**
 * Presentation rules for the Purrfect item record.
 *
 * Every name, id and amount comes from the caller. This module never fills in
 * a sample belonging. Path entry types are not trusted: the API currently
 * labels every ancestor as a location. A location link is only for an id the
 * collection's location list contains, or for EntityOut.location.
 *
 * Open location goes to that nearest location id. The query-context handoff
 * (collection, root, branch, source item) belongs to the next story.
 */

import { validDate } from "~~/composables/utils";
import { parseInventoryId } from "./inventory-context";

const MAX_ANCESTORS = 64;

export type ItemLoadToken = {
  generation: number;
  itemId: string;
  collectionId: string | null;
};

export function createItemLoadGate() {
  let generation = 0;
  let itemId = "";
  let collectionId: string | null = null;

  return {
    /**
     * Start a load for this item and collection. Every earlier response,
     * including one for the same id, is stale.
     */
    begin(nextItemId: string, nextCollectionId: string | null): ItemLoadToken {
      generation += 1;
      itemId = nextItemId;
      collectionId = nextCollectionId;
      return { generation, itemId, collectionId };
    },
    accepts(token: ItemLoadToken): boolean {
      return token.generation === generation && token.itemId === itemId && token.collectionId === collectionId;
    },
  };
}

/** A real asset id. Zero, blank and the empty sentinel are not an identity. */
export function recordedAssetId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0" || trimmed === "000-000" || trimmed === "000000") {
    return null;
  }
  if (trimmed.startsWith("-")) {
    return null;
  }
  const digits = trimmed.replace(/-/g, "");
  if (/^0+$/.test(digits)) {
    return null;
  }
  return trimmed;
}

/** Text the record actually has. Blank is absent, not a placeholder. */
export function recordedText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A date the existing formatter would show. Year-1 and 0001 sentinels are
 * absent — they are not turned into a calendar date.
 */
export function recordedDate(value: unknown): Date | string | null {
  if (typeof value !== "string" && !(value instanceof Date)) {
    return null;
  }
  return validDate(value) ? value : null;
}

export type NamedNode = {
  id?: string | null;
  name?: string | null;
  parent?: NamedNode | null;
};

export type ItemPathEntry = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
};

export type ItemCrumbKind = "collection" | "location" | "item";

export type ItemCrumb = {
  id: string;
  name: string;
  href: string | null;
  kind: ItemCrumbKind;
};

export type ItemLocationPresentation = {
  crumbs: ItemCrumb[];
  locationSegments: Array<{ id: string; name: string }>;
  openLocationHref: string | null;
};

function sameId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function normalizeLocationIds(ids: ReadonlySet<string> | null): Set<string> | null {
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

function ancestorChain(parent: NamedNode | null | undefined): ItemPathEntry[] {
  const chain: ItemPathEntry[] = [];
  const seen = new Set<string>();
  let current = parent ?? null;
  while (current && chain.length < MAX_ANCESTORS) {
    const marker = current.id?.trim() || current.name?.trim() || "";
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

function pathWithoutSelf(itemId: string, path: readonly ItemPathEntry[] | null | undefined): ItemPathEntry[] {
  if (!path || path.length === 0) {
    return [];
  }
  const trimmed = path.slice(0, MAX_ANCESTORS);
  const last = trimmed.at(-1);
  if (last?.id && sameId(last.id, itemId)) {
    return trimmed.slice(0, -1);
  }
  return trimmed.filter(entry => !entry.id || !sameId(entry.id, itemId));
}

export function presentItemLocation(input: {
  itemId: string;
  collectionName?: string | null;
  collectionId?: string | null;
  path?: readonly ItemPathEntry[] | null;
  parent?: NamedNode | null;
  location?: NamedNode | null;
  /** null while this collection's locations have not loaded. An empty set is a loaded collection with no locations. */
  locationIds: ReadonlySet<string> | null;
}): ItemLocationPresentation {
  const knownLocationId = parseInventoryId(input.location?.id);
  const knownIds = normalizeLocationIds(input.locationIds);
  const fromPath = pathWithoutSelf(input.itemId, input.path);
  const ancestors = fromPath.length > 0 ? fromPath : ancestorChain(input.parent);

  const crumbs: ItemCrumb[] = [];
  const collectionName = recordedText(input.collectionName);
  if (collectionName) {
    crumbs.push({
      id: parseInventoryId(input.collectionId) ?? "collection",
      name: collectionName,
      href: "/home",
      kind: "collection",
    });
  }

  const locationSegments: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();

  for (const entry of ancestors) {
    const name = recordedText(entry.name);
    const id = parseInventoryId(entry.id);
    if (!name || !id || sameId(id, input.itemId) || seen.has(id)) {
      continue;
    }
    seen.add(id);

    const isKnownLocation = knownLocationId !== null && id === knownLocationId;
    const listed = knownIds?.has(id) ?? false;
    let kind: ItemCrumbKind | "unknown";
    if (isKnownLocation || listed) {
      kind = "location";
    } else if (knownIds === null) {
      kind = "unknown";
    } else {
      kind = "item";
    }

    // `entry.type` is ignored on purpose. A mislabeled item must not become a location route.
    if (kind === "unknown") {
      crumbs.push({ id, name, href: null, kind: "item" });
      continue;
    }

    const href = kind === "location" ? `/location/${id}` : `/item/${id}`;
    crumbs.push({ id, name, href, kind });
    if (kind === "location") {
      locationSegments.push({ id, name });
    }
  }

  if (knownLocationId && !seen.has(knownLocationId)) {
    const name = recordedText(input.location?.name);
    if (name) {
      locationSegments.push({ id: knownLocationId, name });
      crumbs.push({
        id: knownLocationId,
        name,
        href: `/location/${knownLocationId}`,
        kind: "location",
      });
    }
  }

  const destination = locationSegments.at(-1)?.id ?? knownLocationId;
  return {
    crumbs,
    locationSegments,
    openLocationHref: destination ? `/location/${destination}` : null,
  };
}
