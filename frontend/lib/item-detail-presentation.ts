/**
 * Presentation rules for the Purrfect item record.
 *
 * Every name, id and amount comes from the caller. This module never fills in
 * a sample belonging. Path entry types are not trusted: the API currently
 * labels every ancestor as a location. A location link is only for an id the
 * collection's location list contains, or for EntityOut.location.
 *
 * Open location goes to the root location and carries the foundation hint:
 * collection, root, branch, destination and the item the person came from.
 */

import { validDate } from "~~/composables/utils";
import { deriveItemLocationHandoff, parseInventoryId, type InventoryContext } from "./inventory-context";

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
  locationContext: InventoryContext;
};

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
  const handoff = deriveItemLocationHandoff({
    itemId: input.itemId,
    collectionId: input.collectionId,
    currentCollectionId: input.collectionId ?? null,
    path: input.path,
    parent: input.parent,
    location: input.location,
    locationIds: input.locationIds,
  });

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

  for (const ancestor of handoff.ancestors) {
    if (ancestor.kind === "pending") {
      crumbs.push({ id: ancestor.id, name: ancestor.name, href: null, kind: "item" });
      continue;
    }
    crumbs.push({
      id: ancestor.id,
      name: ancestor.name,
      href: ancestor.kind === "location" ? `/location/${ancestor.id}` : `/item/${ancestor.id}`,
      kind: ancestor.kind,
    });
  }

  return {
    crumbs,
    locationSegments: handoff.locationSegments,
    openLocationHref: handoff.href,
    locationContext: handoff.context,
  };
}
