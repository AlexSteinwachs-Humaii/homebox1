/**
 * Item → location source highlighting.
 *
 * Query ids are hints. A branch is selected and a row is marked Opened only
 * after the source record is read from the signed-in collection and its
 * nearest location is in that branch. Nothing here writes inventory.
 */

import { directLocationChildren, subtreeLocationIds, type BrowseRecord, type LocationRef } from "./location-browse";

export const LOCATION_SOURCE_QUERY_KEYS = [
  "collectionId",
  "rootLocationId",
  "branchId",
  "destinationId",
  "sourceItemId",
] as const;

export type LocationSourceQueryKey = (typeof LOCATION_SOURCE_QUERY_KEYS)[number];

export type LocationSourceHint = {
  collectionId?: string | null;
  rootLocationId?: string | null;
  branchId?: string | null;
  destinationId?: string | null;
  sourceItemId?: string | null;
};

export type SourceProbe =
  | { status: "absent" }
  | { status: "pending" }
  | { status: "missing" }
  | {
      status: "found";
      record: BrowseRecord;
      /** Location ancestors, root-first, already classified against the location index. */
      locationIds: string[];
      nearestLocationId: string | null;
      /** Item containers between the nearest location and the source. Not rows. */
      anchors: BrowseRecord[];
    };

export type ResolvedLocationSource = {
  branchId: string | null;
  /** Exact place to remember. Not the selected branch, even when it is deeper. */
  destinationId: string | null;
  sourceItemId: string | null;
  dropKeys: LocationSourceQueryKey[];
  pending: boolean;
};

export type ClassifiedSourcePath = {
  locationIds: string[];
  nearestLocationId: string | null;
  anchors: BrowseRecord[];
  directParentId: string | null;
};

function sameId(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function canonicalLocationId(id: string | null | undefined, locations: LocationRef[]): string | null {
  if (!id?.trim()) {
    return null;
  }
  return locations.find(location => sameId(location.id, id))?.id ?? null;
}

export function locationInScope(
  locationId: string | null | undefined,
  scopeId: string,
  locations: LocationRef[]
): boolean {
  const location = canonicalLocationId(locationId, locations);
  const scope = canonicalLocationId(scopeId, locations) ?? scopeId;
  if (!location) {
    return false;
  }
  return subtreeLocationIds(scope, locations).some(id => sameId(id, location));
}

/**
 * Path `type` is ignored. Every full-path entry is labeled location by the
 * API, including item containers. Membership in the location index is the
 * classification.
 */
export function classifySourcePath(
  path: ReadonlyArray<{ id?: string | null; name?: string | null; type?: string | null }>,
  itemId: string,
  locations: LocationRef[]
): ClassifiedSourcePath {
  const entries = path.flatMap(entry => {
    const id = entry.id?.trim();
    if (!id || sameId(id, itemId)) {
      return [];
    }
    return [{ id, name: entry.name?.trim() || id }];
  });

  const locationIds: string[] = [];
  for (const entry of entries) {
    const known = canonicalLocationId(entry.id, locations);
    if (known && !locationIds.some(id => sameId(id, known))) {
      locationIds.push(known);
    }
  }

  const nearestLocationId = locationIds.at(-1) ?? null;
  const nearestIndex = nearestLocationId ? entries.findLastIndex(entry => sameId(entry.id, nearestLocationId)) : -1;
  const between = nearestIndex >= 0 ? entries.slice(nearestIndex + 1) : [];
  const anchors: BrowseRecord[] = [];
  let parentId = nearestLocationId;
  for (const entry of between) {
    const known = canonicalLocationId(entry.id, locations);
    if (known) {
      parentId = known;
      continue;
    }
    anchors.push({
      id: entry.id,
      name: entry.name,
      parentId,
      quantity: null,
      purchasePrice: null,
      tags: [],
      imageId: null,
      thumbnailId: null,
    });
    parentId = entry.id;
  }

  return {
    locationIds,
    nearestLocationId,
    anchors,
    directParentId: parentId,
  };
}

/**
 * Stated location (from the entity) and the classified path must agree when
 * both exist. A single source is accepted only when that id is in the index.
 */
export function nearestVerifiedLocation(
  statedLocationId: string | null | undefined,
  classifiedNearestId: string | null | undefined,
  locations: LocationRef[]
): string | null {
  const stated = canonicalLocationId(statedLocationId, locations);
  const classified = canonicalLocationId(classifiedNearestId, locations);
  if (stated && classified && !sameId(stated, classified)) {
    return null;
  }
  return stated ?? classified;
}

export function shouldApplySourceProbe(args: {
  token: number;
  currentToken: number;
  collectionAtStart: string | null;
  currentCollectionId: string | null;
  locationAtStart: string;
  currentLocationId: string;
  sourceAtStart: string;
  currentSourceId: string | null;
}): boolean {
  if (args.token !== args.currentToken) {
    return false;
  }
  if ((args.collectionAtStart ?? "") !== (args.currentCollectionId ?? "")) {
    return false;
  }
  if (args.locationAtStart !== args.currentLocationId) {
    return false;
  }
  return sameId(args.sourceAtStart, args.currentSourceId);
}

function emptyResolution(dropKeys: LocationSourceQueryKey[] = [], pending = false): ResolvedLocationSource {
  return {
    branchId: null,
    destinationId: null,
    sourceItemId: null,
    dropKeys,
    pending,
  };
}

/**
 * Decide which hint can be shown. A branch id alone never selects a place.
 * An exact destination may be deeper than the branch and is not itself the
 * selected place.
 */
export function resolveLocationSource(args: {
  routeLocationId: string;
  currentCollectionId?: string | null;
  hint: LocationSourceHint;
  locations: LocationRef[];
  probe: SourceProbe;
}): ResolvedLocationSource {
  const hint = args.hint;
  const current = args.currentCollectionId?.trim() || null;
  const hintedCollection = hint.collectionId?.trim() || null;
  if (hintedCollection && current && !sameId(hintedCollection, current)) {
    return emptyResolution([...LOCATION_SOURCE_QUERY_KEYS]);
  }
  if (hintedCollection && !current) {
    return emptyResolution([], true);
  }

  const route = args.routeLocationId.trim();
  const hintedRoot = hint.rootLocationId?.trim() || "";
  if (hintedRoot && !sameId(hintedRoot, route)) {
    return emptyResolution(["rootLocationId", "branchId", "destinationId", "sourceItemId"]);
  }

  const sourceHint = hint.sourceItemId?.trim() || "";
  if (!sourceHint) {
    const stray: LocationSourceQueryKey[] = [];
    if (hint.branchId) {
      stray.push("branchId");
    }
    if (hint.destinationId) {
      stray.push("destinationId");
    }
    return emptyResolution(stray);
  }

  if (args.probe.status === "absent" || args.probe.status === "pending") {
    return emptyResolution([], true);
  }
  if (args.probe.status === "missing" || !sameId(args.probe.record.id, sourceHint)) {
    return emptyResolution(["branchId", "destinationId", "sourceItemId"]);
  }

  const nearest = canonicalLocationId(args.probe.nearestLocationId, args.locations);
  if (!nearest || !locationInScope(nearest, route, args.locations)) {
    return emptyResolution(["branchId", "destinationId", "sourceItemId"]);
  }

  const children = directLocationChildren(route, args.locations);
  const locationIds = args.probe.locationIds
    .map(id => canonicalLocationId(id, args.locations))
    .filter((id): id is string => Boolean(id));
  let derived: string | null = null;
  for (const id of locationIds) {
    const child = children.find(place => sameId(place.id, id));
    if (child) {
      derived = child.id;
      break;
    }
  }
  if (!derived && children.some(place => sameId(place.id, nearest))) {
    derived = children.find(place => sameId(place.id, nearest))?.id ?? null;
  }

  const hintedBranchRaw = hint.branchId?.trim() || "";
  const hintedBranch = hintedBranchRaw ? canonicalLocationId(hintedBranchRaw, args.locations) : null;
  if (hintedBranchRaw && (!hintedBranch || !sameId(hintedBranch, derived))) {
    return emptyResolution(["branchId", "destinationId", "sourceItemId"]);
  }

  const scope = derived ?? route;
  const drop: LocationSourceQueryKey[] = [];
  let destinationId: string | null = null;
  const hintedDestinationRaw = hint.destinationId?.trim() || "";
  if (hintedDestinationRaw) {
    const hintedDestination = canonicalLocationId(hintedDestinationRaw, args.locations);
    const onPath =
      Boolean(hintedDestination) &&
      (locationIds.some(id => sameId(id, hintedDestination)) || sameId(hintedDestination, nearest));
    const inScope = Boolean(hintedDestination) && locationInScope(hintedDestination, scope, args.locations);
    if (hintedDestination && onPath && inScope) {
      destinationId = hintedDestination;
    } else {
      drop.push("destinationId");
    }
  } else {
    destinationId = nearest;
  }

  return {
    branchId: derived,
    destinationId,
    sourceItemId: args.probe.record.id,
    dropKeys: drop,
    pending: false,
  };
}

/** Append a looked-up record only when the loaded pages do not already contain it. */
export function withRevealedSource(loaded: readonly BrowseRecord[], source: BrowseRecord | null): BrowseRecord[] {
  if (!source) {
    return [...loaded];
  }
  if (loaded.some(item => sameId(item.id, source.id))) {
    return [...loaded];
  }
  return [...loaded, source];
}
