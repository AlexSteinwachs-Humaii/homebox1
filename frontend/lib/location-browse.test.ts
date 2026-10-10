import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LOCATION_BROWSE_PAGE_SIZE,
  LOCATION_PARENT_BATCH,
  activePlaceId,
  ancestorLocations,
  browseRecordFromSummary,
  childRecordCounts,
  containingLocationId,
  continueLocationWalk,
  createLocationWalk,
  directLocationChildren,
  formatQuantityValue,
  groupBelongings,
  locationRefs,
  nextLocationQuery,
  reduceLocationWalk,
  subtreeLocationIds,
  visibleQuantitySum,
  visibleRecordCount,
  walkIsComplete,
  type BrowseRecord,
  type LocationRef,
} from "./location-browse";

const ROOM = "room";
const PAINT = "paint";
const RACK = "rack";
const BIN = "bin";
const OTHER = "other";
const BOX = "box";
const LAMP = "lamp";
const NAIL = "nail";
const LOOSE = "loose";

function loc(id: string, name: string, parentId: string | null): LocationRef {
  return { id, name, parentId };
}

function record(id: string, name: string, parentId: string | null, extra: Partial<BrowseRecord> = {}): BrowseRecord {
  return {
    id,
    name,
    parentId,
    quantity: 1,
    purchasePrice: 0,
    tags: [],
    imageId: null,
    thumbnailId: null,
    ...extra,
  };
}

const tree: LocationRef[] = [
  loc(ROOM, "Annex", null),
  loc(PAINT, "Paint", ROOM),
  loc(OTHER, "Spare bins", ROOM),
  loc(RACK, "High rack", PAINT),
  loc(BIN, "Left bin", RACK),
];

describe("location children", () => {
  it("keeps only real places and does not treat item children as places", () => {
    const indexed = [
      { id: ROOM, name: "Annex", entityType: { isLocation: true }, parent: null },
      { id: PAINT, name: "Paint", entityType: { isLocation: true }, parent: { id: ROOM } },
      { id: LAMP, name: "Lamp", entityType: { isLocation: false }, parent: { id: ROOM }, itemCount: 9 },
      { id: "typeless", name: "Mystery", parent: { id: ROOM } },
    ];
    const refs = locationRefs(indexed);
    expect(refs.map(ref => ref.id)).toEqual([ROOM, PAINT]);

    const children = directLocationChildren(ROOM, refs, [
      { id: LAMP, name: "Lamp", entityType: { isLocation: false } },
      { id: PAINT, name: "Paint", entityType: { isLocation: true } },
      { id: "loose-item", name: "Screw", entityType: { isLocation: false } },
    ]);
    expect(children.map(child => child.id)).toEqual([PAINT]);
  });

  it("includes a marked location child even before the index lists it", () => {
    const children = directLocationChildren(
      ROOM,
      [],
      [{ id: OTHER, name: "Spare bins", entityType: { isLocation: true } }]
    );
    expect(children).toEqual([{ id: OTHER, name: "Spare bins", parentId: ROOM }]);
  });

  it("walks arbitrary depth and always includes the room itself", () => {
    expect(subtreeLocationIds(ROOM, tree)).toEqual([ROOM, PAINT, RACK, BIN, OTHER]);
    expect(subtreeLocationIds(PAINT, tree)).toEqual([PAINT, RACK, BIN]);
    expect(subtreeLocationIds("missing", tree)).toEqual(["missing"]);
  });

  it("does not select the first child when nothing was chosen", () => {
    expect(activePlaceId(null, [PAINT, OTHER])).toBeNull();
    expect(activePlaceId(undefined, [PAINT, OTHER])).toBeNull();
    expect(activePlaceId("not-a-child", [PAINT, OTHER])).toBeNull();
    expect(activePlaceId(OTHER, [PAINT, OTHER])).toBe(OTHER);
  });

  it("builds ancestor crumbs from parent links", () => {
    expect(ancestorLocations(BIN, tree).map(ref => ref.name)).toEqual(["Annex", "Paint", "High rack"]);
  });
});

describe("inventory walk", () => {
  it("does not query the whole collection when there is no place", () => {
    const walk = createLocationWalk([]);
    expect(walkIsComplete(walk)).toBe(true);
    expect(nextLocationQuery(walk)).toBeNull();
    expect(visibleRecordCount(walk)).toBe(0);
  });

  it("batches parent ids and pages until the API total is loaded", () => {
    const ids = Array.from({ length: LOCATION_PARENT_BATCH + 1 }, (_, index) => `loc-${index}`);
    let walk = createLocationWalk(ids);
    const first = nextLocationQuery(walk);
    expect(first?.parentIds).toHaveLength(LOCATION_PARENT_BATCH);
    expect(first?.pageSize).toBe(LOCATION_BROWSE_PAGE_SIZE);

    walk = reduceLocationWalk(walk, { items: [], total: 0, page: 1, pageSize: LOCATION_BROWSE_PAGE_SIZE });
    const second = nextLocationQuery(walk);
    expect(second?.parentIds).toEqual([`loc-${LOCATION_PARENT_BATCH}`]);
  });

  it("refuses to treat a page as the record count or the quantity sum", () => {
    let walk = createLocationWalk([ROOM]);
    const page = [
      record(LAMP, "Lamp", ROOM, { quantity: 4, purchasePrice: 12 }),
      record(NAIL, "Nails", ROOM, { quantity: 0.5, purchasePrice: 3 }),
    ];
    walk = reduceLocationWalk(walk, {
      items: page,
      total: 25,
      page: 1,
      pageSize: LOCATION_BROWSE_PAGE_SIZE,
    });
    expect(walk.paused).toBe(true);
    expect(walkIsComplete(walk)).toBe(false);
    expect(visibleRecordCount(walk)).toBeNull();
    expect(visibleQuantitySum(walk)).toBeNull();
    expect(walk.loaded).toHaveLength(2);

    walk = continueLocationWalk(walk);
    expect(nextLocationQuery(walk)?.page).toBe(2);
  });

  it("keeps going when a short page still reports a larger total", () => {
    let walk = createLocationWalk([ROOM]);
    walk = reduceLocationWalk(walk, {
      items: [record(LAMP, "Lamp", ROOM)],
      total: 4,
      page: 1,
      pageSize: LOCATION_BROWSE_PAGE_SIZE,
    });
    expect(walkIsComplete(walk)).toBe(false);
    expect(nextLocationQuery(continueLocationWalk(walk))?.page).toBe(2);
  });

  it("expands item containers before calling the set complete", () => {
    let walk = createLocationWalk([ROOM, RACK]);
    walk = reduceLocationWalk(walk, {
      items: [record(BOX, "Crate", RACK, { quantity: 1 }), record(LOOSE, "Loose bulb", ROOM, { quantity: 2 })],
      total: 2,
      page: 1,
      pageSize: LOCATION_BROWSE_PAGE_SIZE,
    });
    expect(walkIsComplete(walk)).toBe(false);
    const nested = nextLocationQuery(walk);
    expect(nested?.parentIds).toEqual([BOX, LOOSE]);

    walk = reduceLocationWalk(walk, {
      items: [record(NAIL, "Nails", BOX, { quantity: 1.5 })],
      total: 1,
      page: 1,
      pageSize: LOCATION_BROWSE_PAGE_SIZE,
    });
    expect(walkIsComplete(walk)).toBe(false);
    walk = reduceLocationWalk(walk, { items: [], total: 0, page: 1, pageSize: LOCATION_BROWSE_PAGE_SIZE });
    expect(walkIsComplete(walk)).toBe(true);
    expect(visibleRecordCount(walk)).toBe(3);
    expect(visibleQuantitySum(walk)).toBe(4.5);
    expect(visibleRecordCount(walk)).not.toBe(visibleQuantitySum(walk));
  });

  it("does not copy a location quantity sum into the record", () => {
    const summary = {
      id: LAMP,
      name: "Lamp",
      parent: { id: RACK },
      quantity: 1.25,
      purchasePrice: 18,
      itemCount: 99,
      tags: [{ id: "tag-1", name: "Travel" }],
      imageId: "img-1",
      thumbnailId: "thumb-1",
    };
    const parsed = browseRecordFromSummary(summary);
    expect(parsed).toMatchObject({
      id: LAMP,
      quantity: 1.25,
      purchasePrice: 18,
      parentId: RACK,
    });
    expect(parsed).not.toHaveProperty("itemCount");
    expect(formatQuantityValue(1.25)).toBe("1.25");
    expect(formatQuantityValue(4)).toBe("4");
  });
});

describe("shelf groups", () => {
  const items = [
    record(BOX, "Crate", RACK),
    record(NAIL, "Nails", BOX, { quantity: 4 }),
    record(LAMP, "Lamp", BIN),
    record(LOOSE, "Loose bulb", ROOM),
    record("brush", "Brush", OTHER),
  ];

  it("groups by location path and keeps containers in the row, not as shelves", () => {
    const groups = groupBelongings(items, tree, PAINT);
    expect(groups.map(group => group.id)).toEqual([RACK, `${RACK}/${BIN}`]);
    const rack = groups.find(group => group.id === RACK);
    expect(rack?.items.map(item => item.id)).toEqual([BOX, NAIL]);
    expect(rack?.items.find(item => item.id === NAIL)?.placeLabel).toBe("High rack · Crate");
    expect(rack?.items.find(item => item.id === BOX)?.placeLabel).toBe("High rack");
    expect(groups.some(group => group.id === BOX)).toBe(false);
  });

  it("includes belongings stored directly in the room when the room is the scope", () => {
    const groups = groupBelongings(items, tree, ROOM);
    expect(groups.find(group => group.id === ROOM)?.items.map(item => item.id)).toEqual([LOOSE]);
    expect(groups.map(group => group.label)).toEqual([
      "Annex",
      "Paint · High rack",
      "Paint · High rack · Left bin",
      "Spare bins",
    ]);
  });

  it("counts records in a child subtree, not quantities or a direct quantity sum", () => {
    const children = directLocationChildren(ROOM, tree);
    const counts = childRecordCounts(items, children, tree);
    expect(counts.get(PAINT)).toBe(3);
    expect(counts.get(OTHER)).toBe(1);
    expect((counts.get(PAINT) ?? 0) + (counts.get(OTHER) ?? 0)).toBe(4);
    expect(items).toHaveLength(5);
    expect(containingLocationId(NAIL, tree, items)).toBe(RACK);
    expect(containingLocationId(LAMP, tree, items)).toBe(BIN);
  });
});

describe("source does not invent rooms", () => {
  it("does not hardcode the design's room or shelf names", () => {
    const files = [
      "./location-browse.ts",
      "../components/Location/PurrfectBrowse.vue",
      "../components/Location/InventoryRows.vue",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/Utility room|Pet supplies|Cleaning/);
    }
    const view = readFileSync(new URL("../components/Location/PurrfectBrowse.vue", import.meta.url), "utf8");
    expect(view).not.toMatch(/itemCount/);
  });
});
