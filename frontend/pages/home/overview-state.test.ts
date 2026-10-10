import { describe, expect, it } from "vitest";
import {
  applyOverviewResult,
  createOverviewGate,
  formatStatNumber,
  overviewCacheKey,
  parseGroupStatistics,
  viewState,
} from "./overview-state";

const COLLECTION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COLLECTION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("overview cache keys", () => {
  it("qualifies statistics and items by collection and never uses the shared keys", () => {
    expect(overviewCacheKey("statistics", COLLECTION_A)).toBe(`home:statistics:${COLLECTION_A}`);
    expect(overviewCacheKey("items", COLLECTION_B)).toBe(`home:items:${COLLECTION_B}`);
    expect(overviewCacheKey("statistics", null)).toBe("home:statistics:unselected");
    expect(overviewCacheKey("statistics", COLLECTION_A)).not.toBe("statistics");
    expect(overviewCacheKey("items", COLLECTION_A)).not.toBe("items");
    expect(overviewCacheKey("statistics", COLLECTION_A)).not.toBe(overviewCacheKey("statistics", COLLECTION_B));
  });
});

describe("overview request gate", () => {
  it("drops a late response from the previous collection", () => {
    const gate = createOverviewGate();
    const collectionA = gate.changeCollection(COLLECTION_A);
    const collectionB = gate.changeCollection(COLLECTION_B);

    expect(gate.accepts(collectionA)).toBe(false);
    expect(gate.accepts(collectionB)).toBe(true);
    expect(gate.accepts(gate.changeCollection(COLLECTION_B))).toBe(true);
  });

  it("drops a late response from an earlier refresh of the same collection", () => {
    const gate = createOverviewGate();
    const first = gate.changeCollection(COLLECTION_A);
    const refresh = gate.refresh();

    expect(gate.accepts(first)).toBe(false);
    expect(gate.accepts(refresh)).toBe(true);
    expect(first.collectionId).toBe(COLLECTION_A);
    expect(refresh.collectionId).toBe(COLLECTION_A);
  });

  it("does not let a previous collection apply after a refresh on the new one", () => {
    const gate = createOverviewGate();
    const collectionA = gate.changeCollection(COLLECTION_A);
    gate.changeCollection(COLLECTION_B);
    const refreshB = gate.refresh();

    expect(gate.accepts(collectionA)).toBe(false);
    expect(gate.accepts(refreshB)).toBe(true);
    expect(refreshB.collectionId).toBe(COLLECTION_B);
  });

  it("keeps collection B when collection A's response arrives late", () => {
    const gate = createOverviewGate();
    const collectionA = gate.changeCollection(COLLECTION_A);
    const pending = { data: null, status: "pending" as const };
    const collectionB = gate.changeCollection(COLLECTION_B);
    const displayed = applyOverviewResult(
      gate.accepts(collectionB),
      { ok: true, data: { items: 4, name: "B" } },
      pending
    );

    const afterLateA = applyOverviewResult(
      gate.accepts(collectionA),
      { ok: true, data: { items: 128, name: "A" } },
      displayed
    );

    expect(afterLateA).toEqual({ data: { items: 4, name: "B" }, status: "ready" });
    expect(afterLateA.data).not.toEqual({ items: 128, name: "A" });
  });

  it("does not turn a failed or stale payload into zero statistics", () => {
    const current = { data: null, status: "pending" as const };
    expect(applyOverviewResult(true, { ok: false }, current)).toEqual({ data: null, status: "error" });
    expect(applyOverviewResult(false, { ok: false }, { data: { totalItems: 9 }, status: "ready" })).toEqual({
      data: { totalItems: 9 },
      status: "ready",
    });
    expect(applyOverviewResult(true, { ok: true, data: { totalItems: 0 } }, current)).toEqual({
      data: { totalItems: 0 },
      status: "ready",
    });
  });
});

describe("parseGroupStatistics", () => {
  it("keeps real zeros and rejects payloads that would have to invent them", () => {
    expect(
      parseGroupStatistics({
        totalItemPrice: 0,
        totalItems: 0,
        totalLocations: 0,
        totalTags: 0,
        totalUsers: 1,
      })
    ).toEqual({
      totalItemPrice: 0,
      totalItems: 0,
      totalLocations: 0,
      totalTags: 0,
    });

    expect(parseGroupStatistics(null)).toBeNull();
    expect(parseGroupStatistics({})).toBeNull();
    expect(
      parseGroupStatistics({
        totalItemPrice: 12,
        totalItems: 3,
        totalLocations: 1,
      })
    ).toBeNull();
    expect(
      parseGroupStatistics({
        totalItemPrice: "8420",
        totalItems: 128,
        totalLocations: 8,
        totalTags: 12,
      })
    ).toBeNull();
  });
});

describe("overview display state", () => {
  it("treats idle and loading as pending, not as an empty success", () => {
    expect(viewState("idle")).toBe("pending");
    expect(viewState("loading")).toBe("pending");
    expect(viewState(undefined)).toBe("pending");
    expect(viewState("ready")).toBe("ready");
    expect(viewState("error")).toBe("error");
  });

  it("formats totals with the locale number formatter", () => {
    expect(formatStatNumber(17, "en-US")).toBe("17");
    expect(formatStatNumber(8420, "en-US")).toBe("8,420");
    expect(formatStatNumber(0, "en-US")).toBe("0");
  });
});
