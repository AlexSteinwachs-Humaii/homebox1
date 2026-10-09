import { describe, expect, it } from "vitest";
import {
  PURRFECT_CONTEXTUAL_ADD_PATH,
  acceptInventoryNavigation,
  collectionIdToActivate,
  encodeInventoryContext,
  inventoryDestinationHref,
  itemsSearchHref,
  parseInventoryDestination,
  parseInventoryId,
  readInventoryContext,
  resolveAddItemLaunch,
} from "./inventory-context";

const COLLECTION = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ROOT = "33333333-3333-4333-8333-333333333333";
const BRANCH = "44444444-4444-4444-8444-444444444444";
const DESTINATION = "55555555-5555-4555-8555-555555555555";
const SOURCE = "66666666-6666-4666-8666-666666666666";

describe("inventory ids", () => {
  it("accepts uuid record ids and rejects everything else", () => {
    expect(parseInventoryId(COLLECTION.toUpperCase())).toBe(COLLECTION);
    expect(parseInventoryId("  " + COLLECTION + " ")).toBe(COLLECTION);
    expect(parseInventoryId("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(parseInventoryId("not-an-id")).toBeNull();
    expect(parseInventoryId("../" + COLLECTION)).toBeNull();
    expect(parseInventoryId(COLLECTION + "/edit")).toBeNull();
    expect(parseInventoryId(1)).toBeNull();
  });
});

describe("inventory destinations", () => {
  it("accepts local inventory routes and encodes their ids", () => {
    const cases = [
      "/home",
      "/items",
      "/locations",
      "/tags",
      "/templates",
      "/maintenance",
      "/profile",
      "/collection",
      "/collection/members",
      "/collection/invites",
      "/collection/notifiers",
      "/collection/settings",
      "/collection/entity-types",
      "/collection/tools",
      "/scanner-ar",
      "/item/add",
      `/location/${ROOT}`,
      `/location/${ROOT}/edit`,
      `/item/${SOURCE}`,
      `/item/${SOURCE}/edit`,
      `/tag/${DESTINATION}`,
      `/template/${DESTINATION}`,
    ];

    for (const href of cases) {
      const parsed = parseInventoryDestination(href);
      expect(parsed.ok, href).toBe(true);
      if (parsed.ok) {
        const built = inventoryDestinationHref(parsed.navigation.destination, parsed.navigation.context);
        expect(built?.startsWith("/")).toBe(true);
        expect(built).not.toMatch(/^https?:/i);
      }
    }
  });

  it("rejects external, traversal and unknown destinations", () => {
    expect(parseInventoryDestination("https://evil.test/home")).toEqual({
      ok: false,
      reason: "external-destination",
    });
    expect(parseInventoryDestination("//evil.test/home")).toEqual({ ok: false, reason: "external-destination" });
    expect(parseInventoryDestination("javascript:alert(1)")).toEqual({ ok: false, reason: "external-destination" });
    expect(parseInventoryDestination("/home/../admin")).toEqual({ ok: false, reason: "malformed" });
    expect(parseInventoryDestination("/\\evil.test")).toEqual({ ok: false, reason: "malformed" });
    expect(parseInventoryDestination("home")).toEqual({ ok: false, reason: "malformed" });
    expect(parseInventoryDestination("/reports")).toEqual({ ok: false, reason: "unknown-destination" });
    expect(parseInventoryDestination(`/location/not-a-uuid`)).toEqual({ ok: false, reason: "invalid-id" });
    expect(parseInventoryDestination(`/item/add/extra`)).toEqual({ ok: false, reason: "unknown-destination" });
  });

  it("rejects arbitrary return urls instead of following them", () => {
    expect(parseInventoryDestination(`/location/${ROOT}?returnUrl=https://evil.test`)).toEqual({
      ok: false,
      reason: "arbitrary-return-url",
    });
    expect(parseInventoryDestination("/home?redirect=/collection/tools")).toEqual({
      ok: false,
      reason: "arbitrary-return-url",
    });
    expect(readInventoryContext("next=https://evil.test")).toEqual({ ok: false, reason: "arbitrary-return-url" });
  });
});

describe("collection context", () => {
  it("keeps compatible ids and never activates another collection", () => {
    const href = `/location/${ROOT}?collectionId=${COLLECTION}&branchId=${BRANCH}&destinationId=${DESTINATION}&sourceItemId=${SOURCE}`;
    const accepted = acceptInventoryNavigation(href, { currentCollectionId: COLLECTION });

    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.navigation.destination).toEqual({ kind: "location", rootLocationId: ROOT });
      expect(accepted.navigation.context).toEqual({
        collectionId: COLLECTION,
        rootLocationId: ROOT,
        branchId: BRANCH,
        destinationId: DESTINATION,
        sourceItemId: SOURCE,
      });
      expect(encodeInventoryContext(accepted.navigation.context)).not.toMatch(/return|redirect|next=/i);
    }

    expect(collectionIdToActivate()).toBeNull();
  });

  it("rejects a context whose collection does not match the signed-in collection", () => {
    const rejected = acceptInventoryNavigation(`/location/${ROOT}?collectionId=${OTHER}&branchId=${BRANCH}`, {
      currentCollectionId: COLLECTION,
    });

    expect(rejected).toEqual({ ok: false, reason: "incompatible-collection" });
    expect(collectionIdToActivate()).toBeNull();
  });

  it("does not treat a query collection as a switch when the current collection is unknown", () => {
    const read = readInventoryContext(`collectionId=${OTHER}&destinationId=${DESTINATION}`);
    expect(read.ok).toBe(true);
    expect(collectionIdToActivate()).toBeNull();
  });
});

describe("search and add item launch", () => {
  it("opens items with an encoded query and no collection switch", () => {
    expect(itemsSearchHref("")).toBeNull();
    expect(itemsSearchHref("cat & carrier/a?b")).toBe("/items?q=cat%20%26%20carrier%2Fa%3Fb");
    expect(itemsSearchHref("https://evil.test")).toBe("/items?q=https%3A%2F%2Fevil.test");
    expect(itemsSearchHref("cat")).not.toContain("collectionId");
    expect(inventoryDestinationHref({ kind: "items", query: "nest" })).toBe("/items?q=nest");
  });

  it("keeps add item on the existing dialog until the purrfect page exists", () => {
    expect(PURRFECT_CONTEXTUAL_ADD_PATH).toBeNull();
    expect(
      resolveAddItemLaunch({
        theme: "purrfect-home",
        currentCollectionId: COLLECTION,
        contextualAddPath: null,
      })
    ).toEqual({ mode: "dialog" });
    expect(
      resolveAddItemLaunch({
        theme: "homebox",
        currentCollectionId: COLLECTION,
        contextualAddPath: "/item/add",
        context: { collectionId: COLLECTION, destinationId: DESTINATION },
      })
    ).toEqual({ mode: "dialog" });
  });

  it("can switch only purrfect home onto the contextual add page", () => {
    const launched = resolveAddItemLaunch({
      theme: "purrfect-home",
      currentCollectionId: COLLECTION,
      contextualAddPath: "/item/add",
      context: {
        collectionId: COLLECTION,
        rootLocationId: ROOT,
        branchId: BRANCH,
        destinationId: DESTINATION,
        sourceItemId: SOURCE,
      },
    });

    expect(launched.mode).toBe("page");
    if (launched.mode === "page") {
      expect(launched.href.startsWith("/item/add?")).toBe(true);
      expect(launched.href).toContain(`collectionId=${COLLECTION}`);
      expect(launched.href).toContain(`destinationId=${DESTINATION}`);
      expect(launched.href).toContain(`rootLocationId=${ROOT}`);
      expect(launched.href).not.toMatch(/return|redirect|https?:/i);
    }

    expect(
      resolveAddItemLaunch({
        theme: "purrfect-home",
        currentCollectionId: COLLECTION,
        contextualAddPath: "/item/add",
        context: `collectionId=${OTHER}&returnUrl=https://evil.test`,
      })
    ).toEqual({ mode: "dialog", reason: "arbitrary-return-url" });

    expect(
      resolveAddItemLaunch({
        theme: "purrfect-home",
        currentCollectionId: COLLECTION,
        contextualAddPath: "/item/add",
        context: { collectionId: COLLECTION, returnUrl: "https://evil.test" },
      })
    ).toEqual({ mode: "dialog", reason: "arbitrary-return-url" });

    expect(
      resolveAddItemLaunch({
        theme: "purrfect-home",
        currentCollectionId: COLLECTION,
        contextualAddPath: "/item/add",
        context: { collectionId: OTHER, destinationId: DESTINATION },
      }).mode
    ).toBe("dialog");

    expect(
      resolveAddItemLaunch({
        theme: "purrfect-home",
        currentCollectionId: COLLECTION,
        contextualAddPath: "https://evil.test/item/add",
      })
    ).toEqual({ mode: "dialog" });
  });
});
