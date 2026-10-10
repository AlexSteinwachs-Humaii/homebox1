import { describe, expect, it } from "vitest";
import { groupBelongings, type BrowseRecord, type LocationRef } from "./location-browse";
import {
  classifySourcePath,
  locationInScope,
  nearestVerifiedLocation,
  resolveLocationSource,
  shouldApplySourceProbe,
  withRevealedSource,
  type SourceProbe,
} from "./location-source";

const ROOM = "room";
const SUPPLIES = "supplies";
const CLEANING = "cleaning";
const SHELF = "shelf";
const OTHER = "other-room";
const BOX = "box";
const ITEM = "carrier";
const COLLECTION = "collection";

function loc(id: string, name: string, parentId: string | null): LocationRef {
  return { id, name, parentId };
}

function record(id: string, name: string, parentId: string | null): BrowseRecord {
  return {
    id,
    name,
    parentId,
    quantity: 1,
    purchasePrice: 12,
    tags: [{ id: "tag", name: "Travel" }],
    imageId: null,
    thumbnailId: null,
  };
}

const locations = [
  loc(ROOM, "Utility room", null),
  loc(SUPPLIES, "Pet supplies", ROOM),
  loc(CLEANING, "Cleaning", ROOM),
  loc(SHELF, "Top shelf", SUPPLIES),
  loc(OTHER, "Loft", null),
];

function found(extra: Partial<Extract<SourceProbe, { status: "found" }>> = {}): SourceProbe {
  return {
    status: "found",
    record: record(ITEM, "Cat carrier", SHELF),
    locationIds: [ROOM, SUPPLIES, SHELF],
    nearestLocationId: SHELF,
    anchors: [],
    ...extra,
  };
}

describe("classifySourcePath", () => {
  it("treats path type as untrusted and keeps item containers out of the location chain", () => {
    const classified = classifySourcePath(
      [
        { id: ROOM, name: "Utility room", type: "location" },
        { id: SUPPLIES, name: "Pet supplies", type: "location" },
        { id: SHELF, name: "Top shelf", type: "location" },
        { id: BOX, name: "Travel box", type: "location" },
        { id: ITEM, name: "Cat carrier", type: "location" },
      ],
      ITEM,
      locations
    );

    expect(classified.locationIds).toEqual([ROOM, SUPPLIES, SHELF]);
    expect(classified.nearestLocationId).toBe(SHELF);
    expect(classified.anchors.map(anchor => anchor.id)).toEqual([BOX]);
    expect(classified.anchors[0]?.parentId).toBe(SHELF);
    expect(classified.directParentId).toBe(BOX);
  });
});

describe("nearestVerifiedLocation", () => {
  it("requires the entity location and the classified path to name the same place", () => {
    expect(nearestVerifiedLocation(SHELF, SHELF, locations)).toBe(SHELF);
    expect(nearestVerifiedLocation(SHELF, null, locations)).toBe(SHELF);
    expect(nearestVerifiedLocation(null, SHELF, locations)).toBe(SHELF);
    expect(nearestVerifiedLocation(CLEANING, SHELF, locations)).toBeNull();
    expect(nearestVerifiedLocation("missing", null, locations)).toBeNull();
  });
});

describe("resolveLocationSource", () => {
  const base = {
    routeLocationId: ROOM,
    currentCollectionId: COLLECTION,
    locations,
  };

  it("selects the item branch and keeps a destination deeper than that branch", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: {
        collectionId: COLLECTION,
        rootLocationId: ROOM,
        branchId: SUPPLIES,
        destinationId: SHELF,
        sourceItemId: ITEM,
      },
      probe: found(),
    });

    expect(resolved.pending).toBe(false);
    expect(resolved.branchId).toBe(SUPPLIES);
    expect(resolved.destinationId).toBe(SHELF);
    expect(resolved.destinationId).not.toBe(resolved.branchId);
    expect(resolved.sourceItemId).toBe(ITEM);
    expect(resolved.dropKeys).toEqual([]);
  });

  it("derives the branch from the verified item when the hint omits it", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { sourceItemId: ITEM, destinationId: SHELF },
      probe: found(),
    });

    expect(resolved.branchId).toBe(SUPPLIES);
    expect(resolved.destinationId).toBe(SHELF);
    expect(resolved.sourceItemId).toBe(ITEM);
  });

  it("does not select a place when there is no source", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { branchId: SUPPLIES, destinationId: SHELF },
      probe: { status: "absent" },
    });

    expect(resolved.branchId).toBeNull();
    expect(resolved.destinationId).toBeNull();
    expect(resolved.sourceItemId).toBeNull();
    expect(resolved.dropKeys).toEqual(["branchId", "destinationId"]);
    expect(resolved.pending).toBe(false);
  });

  it("waits to select a branch until the source record has been checked", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { branchId: SUPPLIES, destinationId: SHELF, sourceItemId: ITEM },
      probe: { status: "pending" },
    });

    expect(resolved.pending).toBe(true);
    expect(resolved.branchId).toBeNull();
    expect(resolved.dropKeys).toEqual([]);
  });

  it("drops an unknown or deleted source instead of inventing a row", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { branchId: SUPPLIES, destinationId: SHELF, sourceItemId: ITEM },
      probe: { status: "missing" },
    });

    expect(resolved.sourceItemId).toBeNull();
    expect(resolved.branchId).toBeNull();
    expect(resolved.dropKeys).toEqual(["branchId", "destinationId", "sourceItemId"]);
  });

  it("falls back when the branch is unrelated to the item or the room", () => {
    const sibling = resolveLocationSource({
      ...base,
      hint: { branchId: CLEANING, destinationId: SHELF, sourceItemId: ITEM },
      probe: found(),
    });
    expect(sibling.branchId).toBeNull();
    expect(sibling.sourceItemId).toBeNull();
    expect(sibling.dropKeys).toContain("branchId");

    const otherRoom = resolveLocationSource({
      ...base,
      hint: { branchId: OTHER, sourceItemId: ITEM },
      probe: found(),
    });
    expect(otherRoom.sourceItemId).toBeNull();
    expect(otherRoom.branchId).toBeNull();
  });

  it("drops a source whose location is not in this room", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { sourceItemId: ITEM, branchId: SUPPLIES },
      probe: found({ locationIds: [OTHER], nearestLocationId: OTHER }),
    });

    expect(resolved.sourceItemId).toBeNull();
    expect(resolved.dropKeys).toContain("sourceItemId");
  });

  it("drops an incompatible collection and a root that is not this room", () => {
    const collection = resolveLocationSource({
      ...base,
      hint: { collectionId: "other-collection", branchId: SUPPLIES, sourceItemId: ITEM },
      probe: found(),
    });
    expect(collection.sourceItemId).toBeNull();
    expect(collection.dropKeys).toContain("collectionId");
    expect(collection.dropKeys).toContain("sourceItemId");

    const root = resolveLocationSource({
      ...base,
      hint: { rootLocationId: OTHER, branchId: SUPPLIES, sourceItemId: ITEM },
      probe: found(),
    });
    expect(root.branchId).toBeNull();
    expect(root.dropKeys).toContain("rootLocationId");
  });

  it("keeps the source when only the destination is incompatible", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { branchId: SUPPLIES, destinationId: CLEANING, sourceItemId: ITEM },
      probe: found(),
    });

    expect(resolved.branchId).toBe(SUPPLIES);
    expect(resolved.sourceItemId).toBe(ITEM);
    expect(resolved.destinationId).toBeNull();
    expect(resolved.dropKeys).toEqual(["destinationId"]);
  });

  it("does not treat a destination as the selected branch", () => {
    const resolved = resolveLocationSource({
      ...base,
      hint: { branchId: SUPPLIES, destinationId: SHELF, sourceItemId: ITEM },
      probe: found(),
    });
    const children = [SUPPLIES, CLEANING];
    expect(children).toContain(resolved.branchId);
    expect(children).not.toContain(resolved.destinationId);
  });
});

describe("reveal and stale probes", () => {
  it("reveals a real record that is not on the loaded page and does not duplicate it", () => {
    const source = record(ITEM, "Cat carrier", SHELF);
    const page = [record("other", "Food", SHELF)];
    expect(withRevealedSource(page, source).map(item => item.id)).toEqual(["other", ITEM]);
    expect(withRevealedSource([...page, source], source)).toHaveLength(2);
    expect(withRevealedSource(page, null)).toEqual(page);
  });

  it("uses anchors so a revealed nested item keeps its container in the label only", () => {
    const source = record(ITEM, "Cat carrier", BOX);
    const anchors = [record(BOX, "Travel box", SHELF)];
    const groups = groupBelongings([source], locations, SUPPLIES, anchors);
    expect(groups.flatMap(group => group.items.map(item => item.id))).toEqual([ITEM]);
    expect(groups[0]?.items[0]?.placeLabel).toContain("Travel box");
    expect(groups[0]?.items[0]?.placeLabel).toContain("Top shelf");
  });

  it("refuses a probe after the collection, room, or source has changed", () => {
    expect(
      shouldApplySourceProbe({
        token: 2,
        currentToken: 2,
        collectionAtStart: COLLECTION,
        currentCollectionId: COLLECTION,
        locationAtStart: ROOM,
        currentLocationId: ROOM,
        sourceAtStart: ITEM,
        currentSourceId: ITEM,
      })
    ).toBe(true);
    expect(
      shouldApplySourceProbe({
        token: 1,
        currentToken: 2,
        collectionAtStart: COLLECTION,
        currentCollectionId: COLLECTION,
        locationAtStart: ROOM,
        currentLocationId: ROOM,
        sourceAtStart: ITEM,
        currentSourceId: ITEM,
      })
    ).toBe(false);
    expect(
      shouldApplySourceProbe({
        token: 2,
        currentToken: 2,
        collectionAtStart: COLLECTION,
        currentCollectionId: "next",
        locationAtStart: ROOM,
        currentLocationId: ROOM,
        sourceAtStart: ITEM,
        currentSourceId: ITEM,
      })
    ).toBe(false);
    expect(
      shouldApplySourceProbe({
        token: 2,
        currentToken: 2,
        collectionAtStart: COLLECTION,
        currentCollectionId: COLLECTION,
        locationAtStart: ROOM,
        currentLocationId: OTHER,
        sourceAtStart: ITEM,
        currentSourceId: ITEM,
      })
    ).toBe(false);
  });

  it("knows when a source location is outside the place being shown", () => {
    expect(locationInScope(SHELF, SUPPLIES, locations)).toBe(true);
    expect(locationInScope(SHELF, CLEANING, locations)).toBe(false);
    expect(locationInScope(SHELF, ROOM, locations)).toBe(true);
  });
});
