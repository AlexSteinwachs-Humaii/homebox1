import { describe, expect, it } from "vitest";
import {
  createItemLoadGate,
  presentItemLocation,
  recordedAssetId,
  recordedDate,
  recordedText,
} from "./item-detail-presentation";

const ITEM = "77777777-7777-4777-8777-777777777771";
const SHELF = "77777777-7777-4777-8777-777777777773";
const SUPPLIES = "77777777-7777-4777-8777-777777777774";
const ROOM = "77777777-7777-4777-8777-777777777775";
const BOX = "77777777-7777-4777-8777-777777777778";
const COLLECTION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const LOCATIONS = new Set([ROOM, SUPPLIES, SHELF]);

describe("recorded item fields", () => {
  it("keeps a real asset id and drops empty sentinels", () => {
    expect(recordedAssetId("000-071")).toBe("000-071");
    expect(recordedAssetId(" 12 ")).toBe("12");
    expect(recordedAssetId("")).toBeNull();
    expect(recordedAssetId("0")).toBeNull();
    expect(recordedAssetId("000-000")).toBeNull();
    expect(recordedAssetId("000000")).toBeNull();
    expect(recordedAssetId("-1")).toBeNull();
    expect(recordedAssetId(71)).toBeNull();
  });

  it("does not turn an empty date sentinel into a date", () => {
    expect(recordedDate("2026-01-08")).toBe("2026-01-08");
    expect(recordedDate("0001-01-01T00:00:00Z")).toBeNull();
    expect(recordedDate("0001-01-01")).toBeNull();
    expect(recordedDate("")).toBeNull();
    expect(recordedDate(null)).toBeNull();
    const sentinel = new Date("0001-01-01T00:00:00Z");
    expect(recordedDate(sentinel)).toBeNull();
    expect(recordedText("  Soft-sided  ")).toBe("Soft-sided");
    expect(recordedText("   ")).toBeNull();
    expect(recordedText(null)).toBeNull();
  });
});

describe("item load gate", () => {
  it("drops a response from the previous item or collection", () => {
    const gate = createItemLoadGate();
    const first = gate.begin(ITEM, COLLECTION);
    const otherItem = gate.begin(BOX, COLLECTION);
    expect(gate.accepts(first)).toBe(false);
    expect(gate.accepts(otherItem)).toBe(true);

    const otherCollection = gate.begin(BOX, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(gate.accepts(otherItem)).toBe(false);
    expect(gate.accepts(otherCollection)).toBe(true);
  });

  it("drops an older response for the same item", () => {
    const gate = createItemLoadGate();
    const first = gate.begin(ITEM, COLLECTION);
    const retry = gate.begin(ITEM, COLLECTION);
    expect(gate.accepts(first)).toBe(false);
    expect(gate.accepts(retry)).toBe(true);
  });
});

describe("presentItemLocation", () => {
  it("uses real ancestor names and does not trust a location type label", () => {
    const presented = presentItemLocation({
      itemId: ITEM,
      collectionName: "My Home",
      collectionId: COLLECTION,
      locationIds: LOCATIONS,
      location: { id: SHELF, name: "Top shelf" },
      path: [
        { id: ROOM, name: "Utility room", type: "location" },
        { id: SUPPLIES, name: "Pet supplies", type: "location" },
        { id: BOX, name: "Travel box", type: "location" },
        { id: SHELF, name: "Top shelf", type: "item" },
        { id: ITEM, name: "Cat carrier", type: "location" },
      ],
    });

    expect(presented.crumbs.map(crumb => crumb.name)).toEqual([
      "My Home",
      "Utility room",
      "Pet supplies",
      "Travel box",
      "Top shelf",
    ]);
    expect(presented.crumbs.find(crumb => crumb.id === BOX)).toMatchObject({
      kind: "item",
      href: `/item/${BOX}`,
    });
    expect(presented.crumbs.find(crumb => crumb.id === SHELF)).toMatchObject({
      kind: "location",
      href: `/location/${SHELF}`,
    });
    expect(presented.locationSegments.map(segment => segment.name)).toEqual([
      "Utility room",
      "Pet supplies",
      "Top shelf",
    ]);
    expect(presented.openLocationHref).toBe(
      `/location/${ROOM}?collectionId=${COLLECTION}&rootLocationId=${ROOM}&branchId=${SUPPLIES}&destinationId=${SHELF}&sourceItemId=${ITEM}`
    );
    expect(presented.locationContext.sourceItemId).toBe(ITEM);
    expect(presented.crumbs.some(crumb => crumb.name === "Cat carrier")).toBe(false);
  });

  it("does not invent a location when the record has none", () => {
    const presented = presentItemLocation({
      itemId: ITEM,
      collectionName: "",
      locationIds: LOCATIONS,
      path: [{ id: ITEM, name: "Loose screw", type: "location" }],
    });

    expect(presented.crumbs).toEqual([]);
    expect(presented.locationSegments).toEqual([]);
    expect(presented.openLocationHref).toBeNull();
    expect(presented.locationContext).toEqual({});
  });

  it("uses the nearest location when the path mislabels every ancestor and the list has not loaded", () => {
    const presented = presentItemLocation({
      itemId: ITEM,
      collectionName: "My Home",
      locationIds: null,
      location: { id: SHELF, name: "Top shelf" },
      path: [
        { id: ROOM, name: "Utility room", type: "location" },
        { id: BOX, name: "Travel box", type: "location" },
        { id: ITEM, name: "Cat carrier", type: "location" },
      ],
    });

    expect(presented.crumbs.find(crumb => crumb.id === ROOM)?.href).toBeNull();
    expect(presented.crumbs.find(crumb => crumb.id === BOX)?.href).toBeNull();
    expect(presented.openLocationHref).toBe(
      `/location/${SHELF}?rootLocationId=${SHELF}&destinationId=${SHELF}&sourceItemId=${ITEM}`
    );
    expect(presented.locationSegments).toEqual([{ id: SHELF, name: "Top shelf" }]);
  });

  it("derives a nested item's location from the location ancestor, not its item parent", () => {
    const presented = presentItemLocation({
      itemId: ITEM,
      locationIds: new Set([ROOM]),
      location: { id: ROOM, name: "Utility room" },
      parent: { id: BOX, name: "Travel box", parent: { id: ROOM, name: "Utility room" } },
    });

    expect(presented.openLocationHref).toBe(
      `/location/${ROOM}?rootLocationId=${ROOM}&destinationId=${ROOM}&sourceItemId=${ITEM}`
    );
    expect(presented.crumbs.find(crumb => crumb.id === BOX)?.href).toBe(`/item/${BOX}`);
    expect(presented.locationSegments.map(segment => segment.id)).toEqual([ROOM]);
  });
});
