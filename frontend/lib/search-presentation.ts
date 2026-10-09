/**
 * Presentation for Design C search.
 *
 * The count is the list endpoint's total. A page of cards is not the result
 * count, and a picture of three sample belongings is not a result set.
 * Search still matches name, description, serial, model, manufacturer and
 * notes. Copy must not claim a name-only search or an implicit pet filter.
 */

export const SEARCH_TEXT_FIELDS = [
  "name",
  "description",
  "serial number",
  "model number",
  "manufacturer",
  "notes",
] as const;

export type SearchHeadingMode = "match" | "asset" | "browse";

export type SearchPresentationInput = {
  apiTotal: number;
  pageLength: number;
  query: string;
  byAssetId: boolean;
  assetIdLabel: string;
  collectionName: string;
  locationFilterCount: number;
  tagFilterCount: number;
  includeArchived: boolean;
  onlyWithPhoto: boolean;
  onlyWithoutPhoto: boolean;
  fieldFilterCount: number;
  negateTags: boolean;
  /** Non-default sort. Omitted callers are treated as the default name order. */
  ordered?: boolean;
};

export type SearchPresentation = {
  count: number;
  shown: number;
  mode: SearchHeadingMode;
  query: string;
  assetIdLabel: string;
  collectionName: string;
  filtersApplied: boolean;
};

export function searchFiltersApplied(input: SearchPresentationInput): boolean {
  return (
    input.locationFilterCount > 0 ||
    input.tagFilterCount > 0 ||
    input.includeArchived ||
    input.onlyWithPhoto ||
    input.onlyWithoutPhoto ||
    input.fieldFilterCount > 0 ||
    input.negateTags ||
    input.ordered === true
  );
}

export function searchPresentation(input: SearchPresentationInput): SearchPresentation {
  const query = input.query.trim();
  let mode: SearchHeadingMode = "browse";
  if (input.byAssetId) {
    mode = "asset";
  } else if (query) {
    mode = "match";
  }

  const total = Number.isFinite(input.apiTotal) ? input.apiTotal : 0;

  return {
    count: total,
    shown: Math.max(0, input.pageLength),
    mode,
    query,
    assetIdLabel: input.assetIdLabel,
    collectionName: input.collectionName.trim(),
    filtersApplied: searchFiltersApplied(input),
  };
}
