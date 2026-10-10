import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SEARCH_TEXT_FIELDS, searchPresentation, type SearchPresentationInput } from "./search-presentation";

const base: SearchPresentationInput = {
  apiTotal: 17,
  pageLength: 3,
  query: "cat",
  byAssetId: false,
  assetIdLabel: "",
  collectionName: "My Home",
  locationFilterCount: 0,
  tagFilterCount: 0,
  includeArchived: false,
  onlyWithPhoto: false,
  onlyWithoutPhoto: false,
  fieldFilterCount: 0,
  negateTags: false,
};

describe("search presentation", () => {
  it("uses the API total, not the current page or a sample of three", () => {
    const presented = searchPresentation(base);
    expect(presented.count).toBe(17);
    expect(presented.count).not.toBe(presented.shown);
    expect(presented.shown).toBe(3);
    expect(presented.mode).toBe("match");
    expect(presented.filtersApplied).toBe(false);
  });

  it("does not treat an empty page as permission to invent a count", () => {
    expect(searchPresentation({ ...base, apiTotal: 0, pageLength: 0 }).count).toBe(0);
    expect(searchPresentation({ ...base, apiTotal: 4, pageLength: 0 }).count).toBe(4);
  });

  it("keeps a name query as text search without assuming location or tag filters", () => {
    const presented = searchPresentation({ ...base, query: "  cat  " });
    expect(presented.query).toBe("cat");
    expect(presented.mode).toBe("match");
    expect(presented.filtersApplied).toBe(false);
  });

  it("describes an asset id lookup separately from a text search", () => {
    const presented = searchPresentation({
      ...base,
      query: "#000-001",
      byAssetId: true,
      assetIdLabel: "1",
    });
    expect(presented.mode).toBe("asset");
    expect(presented.assetIdLabel).toBe("1");
  });

  it("browses the collection when there is no query", () => {
    expect(searchPresentation({ ...base, query: "   " }).mode).toBe("browse");
  });

  it("marks only controls the person actually applied", () => {
    expect(searchPresentation({ ...base, locationFilterCount: 1 }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, tagFilterCount: 2 }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, includeArchived: true }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, onlyWithPhoto: true }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, onlyWithoutPhoto: true }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, fieldFilterCount: 1 }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, negateTags: true }).filtersApplied).toBe(true);
    expect(searchPresentation({ ...base, ordered: true }).filtersApplied).toBe(true);
    expect(searchPresentation(base).filtersApplied).toBe(false);
  });
});

describe("search copy", () => {
  const messages = JSON.parse(readFileSync(fileURLToPath(new URL("../locales/en.json", import.meta.url)), "utf8")) as {
    purrfect: Record<string, string>;
  };

  const searchCopy = Object.entries(messages.purrfect).filter(([key]) => key.startsWith("search_"));

  it("names the fields the API actually searches", () => {
    const behavior = messages.purrfect.search_behavior ?? "";
    expect(behavior).not.toBe("");
    for (const field of SEARCH_TEXT_FIELDS) {
      expect(behavior.toLowerCase()).toContain(field);
    }
  });

  it("does not claim a name-only search or an implicit pet filter", () => {
    for (const [key, value] of searchCopy) {
      expect(value, key).not.toMatch(/name matches only/i);
      expect(value, key).not.toMatch(/name contains/i);
      expect(value, key).not.toMatch(/name-only/i);
      expect(value, key).not.toMatch(/filtered by pet/i);
      expect(value, key).not.toMatch(/nothing was filtered/i);
    }
  });
});
