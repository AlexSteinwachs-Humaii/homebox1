import { describe, expect, it } from "vitest";
import type { LocationRef } from "./location-browse";
import { buildLocationAddContext } from "./location-add";

const COLLECTION = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ROOM = "33333333-3333-4333-8333-333333333333";
const BRANCH = "44444444-4444-4444-8444-444444444444";
const OTHER_BRANCH = "55555555-5555-4555-8555-555555555555";
const SHELF = "66666666-6666-4666-8666-666666666666";
const DEEPER = "77777777-7777-4777-8777-777777777777";
const SOURCE = "88888888-8888-4888-8888-888888888888";

const locations: LocationRef[] = [
  { id: ROOM, name: "Annex", parentId: null },
  { id: BRANCH, name: "Paint", parentId: ROOM },
  { id: OTHER_BRANCH, name: "Spare bins", parentId: ROOM },
  { id: SHELF, name: "High rack", parentId: BRANCH },
  { id: DEEPER, name: "Left bin", parentId: SHELF },
];

describe("buildLocationAddContext", () => {
  it("files into the room itself when no branch or shelf was chosen", () => {
    expect(
      buildLocationAddContext({
        collectionId: COLLECTION,
        roomId: ROOM,
        locations,
      })
    ).toEqual({
      collectionId: COLLECTION,
      rootLocationId: ROOM,
      destinationId: ROOM,
    });
  });

  it("uses the selected branch and does not guess the first shelf", () => {
    const context = buildLocationAddContext({
      collectionId: COLLECTION,
      roomId: ROOM,
      branchId: BRANCH,
      locations,
    });
    expect(context?.destinationId).toBe(BRANCH);
    expect(context?.branchId).toBe(BRANCH);
    expect(context?.destinationId).not.toBe(SHELF);
    expect(context?.destinationId).not.toBe(DEEPER);
  });

  it("keeps an exact shelf from a handoff or an explicit choice", () => {
    expect(
      buildLocationAddContext({
        collectionId: COLLECTION,
        roomId: ROOM,
        branchId: BRANCH,
        exactDestinationId: DEEPER,
        sourceItemId: SOURCE,
        locations,
      })
    ).toMatchObject({
      collectionId: COLLECTION,
      rootLocationId: ROOM,
      branchId: BRANCH,
      destinationId: DEEPER,
      sourceItemId: SOURCE,
    });
  });

  it("drops an exact shelf that is outside the selected branch", () => {
    const context = buildLocationAddContext({
      collectionId: COLLECTION,
      roomId: ROOM,
      branchId: OTHER_BRANCH,
      exactDestinationId: DEEPER,
      sourceItemId: SOURCE,
      locations,
    });
    expect(context?.destinationId).toBe(OTHER_BRANCH);
    expect(context?.destinationId).not.toBe(DEEPER);
    expect(context?.destinationId).not.toBe(SHELF);
  });

  it("ignores a branch that is not in this room without dropping a shelf still in the room", () => {
    const context = buildLocationAddContext({
      collectionId: COLLECTION,
      roomId: ROOM,
      branchId: OTHER,
      exactDestinationId: SHELF,
      locations,
    });
    expect(context?.branchId).toBeUndefined();
    expect(context?.destinationId).toBe(SHELF);
    expect(context?.destinationId).not.toBe(DEEPER);
  });

  it("does not invent a shelf when the index has not loaded", () => {
    expect(
      buildLocationAddContext({
        collectionId: COLLECTION,
        roomId: ROOM,
        branchId: BRANCH,
        exactDestinationId: SHELF,
        locations: [],
      })
    ).toEqual({
      collectionId: COLLECTION,
      rootLocationId: ROOM,
      destinationId: ROOM,
    });
  });

  it("omits a collection or source that is not a record id", () => {
    const context = buildLocationAddContext({
      collectionId: "not-a-collection",
      roomId: ROOM,
      sourceItemId: "https://evil.test",
      locations,
    });
    expect(context?.collectionId).toBeUndefined();
    expect(context?.sourceItemId).toBeUndefined();
    expect(context?.destinationId).toBe(ROOM);
  });
});
