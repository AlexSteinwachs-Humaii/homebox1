import { describe, expect, it } from "vitest";
import {
  applySearchResponse,
  compatibleFieldFilters,
  compatibleSelections,
  createSearchGate,
  optionsAreActive,
  pageAfterChange,
  paginationCounts,
  phaseWhileLoading,
  searchChips,
  type SearchFilterState,
} from "./search-session";

const labels = {
  archived: "Include archived",
  withPhoto: "With a photo",
  withoutPhoto: "Without a photo",
  negateTags: "Exclude selected tags",
  order: (order: string) => `Order by ${order}`,
  field: (field: string, value: string) => `${field} is ${value}`,
};

function filters(patch: Partial<SearchFilterState> = {}): SearchFilterState {
  return {
    locations: [],
    tags: [],
    includeArchived: false,
    onlyWithPhoto: false,
    onlyWithoutPhoto: false,
    negateTags: false,
    orderBy: "name",
    fields: [],
    ...patch,
  };
}

describe("search gate", () => {
  it("ignores a late response from the previous collection", () => {
    const gate = createSearchGate();
    const first = gate.begin();
    const switched = gate.changeCollection("collection-b");
    const second = gate.begin();

    expect(gate.accepts(first)).toBe(false);
    expect(gate.accepts(switched)).toBe(false);
    expect(gate.accepts(second)).toBe(true);
    expect(second.collectionId).toBe("collection-b");
  });

  it("ignores an older response for the same collection", () => {
    const gate = createSearchGate();
    gate.changeCollection("collection-a");
    const older = gate.begin();
    const newer = gate.begin();

    expect(gate.accepts(older)).toBe(false);
    expect(gate.accepts(newer)).toBe(true);
  });
});

describe("pagination", () => {
  it("resets the page for query, filter and page size, and keeps it for view and retry", () => {
    expect(pageAfterChange(4, "query")).toBe(1);
    expect(pageAfterChange(4, "filter")).toBe(1);
    expect(pageAfterChange(4, "pageSize")).toBe(1);
    expect(pageAfterChange(4, "view")).toBe(4);
    expect(pageAfterChange(4, "retry")).toBe(4);
    expect(pageAfterChange(4, "page")).toBe(4);
  });

  it("does not walk backward on a miss or a failure", () => {
    const miss = applySearchResponse({
      accepts: true,
      outcome: { ok: true, items: [], total: 0 },
      requestedPage: 3,
      pageSize: 12,
      collectionId: "collection-a",
    });
    expect(miss.refetch).toBe(false);
    expect(miss.page).toBe(1);
    expect(miss.snapshot?.phase).toBe("empty");
    expect(miss.snapshot?.total).toBe(0);

    const failed = applySearchResponse({
      accepts: true,
      outcome: { ok: false },
      requestedPage: 3,
      pageSize: 12,
      collectionId: "collection-a",
    });
    expect(failed.refetch).toBe(false);
    expect(failed.page).toBe(3);
    expect(failed.snapshot?.phase).toBe("error");
    expect(failed.snapshot?.items).toEqual([]);
  });

  it("clamps an empty page past the end once and keeps a real page of results", () => {
    const pastEnd = applySearchResponse({
      accepts: true,
      outcome: { ok: true, items: [], total: 30 },
      requestedPage: 9,
      pageSize: 12,
      collectionId: "collection-a",
    });
    expect(pastEnd.refetch).toBe(true);
    expect(pastEnd.page).toBe(3);
    expect(pastEnd.snapshot).toBeNull();

    const page = applySearchResponse({
      accepts: true,
      outcome: { ok: true, items: [{ id: "item" }], total: 30 },
      requestedPage: 2,
      pageSize: 12,
      collectionId: "collection-a",
    });
    expect(page.snapshot?.phase).toBe("ready");
    expect(page.snapshot?.total).toBe(30);
    expect(paginationCounts(2, 12, 30)).toEqual({ page: 2, pageSize: 12, total: 30, totalPages: 3 });
  });

  it("does not let a stale response replace the current snapshot", () => {
    const stale = applySearchResponse({
      accepts: false,
      outcome: { ok: true, items: [{ id: "old" }], total: 1 },
      requestedPage: 1,
      pageSize: 12,
      collectionId: "collection-a",
    });
    expect(stale.accepted).toBe(false);
    expect(stale.snapshot).toBeNull();
  });
});

describe("applied filters", () => {
  it("chips and the options state match values that are actually applied", () => {
    const state = filters({
      locations: [{ id: "loc", name: "Utility room" }],
      tags: [{ id: "tag", name: "Travel" }],
      includeArchived: true,
      onlyWithPhoto: true,
      negateTags: true,
      orderBy: "createdAt",
      fields: [{ field: "Color", value: "Orange" }],
    });

    expect(optionsAreActive(state)).toBe(true);
    expect(optionsAreActive(filters())).toBe(false);
    expect(optionsAreActive(filters({ fields: [{ field: "Color", value: "" }] }))).toBe(false);

    const chips = searchChips(state, labels);
    expect(chips.map(chip => chip.label)).toEqual([
      "Utility room",
      "Travel",
      "Include archived",
      "With a photo",
      "Exclude selected tags",
      "Order by createdAt",
      "Color is Orange",
    ]);
    expect(chips.find(chip => chip.kind === "location")?.id).toBe("loc");
  });

  it("drops location, tag and field ids the current collection does not have", () => {
    const locations = compatibleSelections(
      ["keep", "gone", "keep"],
      [
        { id: "keep", name: "Kitchen" },
        { id: "other", name: "Garage" },
      ]
    );
    expect(locations.kept.map(item => item.id)).toEqual(["keep"]);
    expect(locations.droppedIds).toEqual(["gone"]);

    expect(
      compatibleFieldFilters(
        [
          ["Color", "Orange"],
          ["Room", "Den"],
          ["", ""],
        ],
        ["Color"]
      )
    ).toEqual([
      ["Color", "Orange"],
      ["", ""],
    ]);
  });

  it("treats the first load differently from a later refresh", () => {
    expect(phaseWhileLoading("initial")).toBe("initial");
    expect(phaseWhileLoading("ready")).toBe("refreshing");
    expect(phaseWhileLoading("empty")).toBe("refreshing");
    expect(phaseWhileLoading("error")).toBe("refreshing");
  });
});
