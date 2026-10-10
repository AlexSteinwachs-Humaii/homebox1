/**
 * Collection-scoped search session.
 *
 * A response is applied only when it is still the latest request for the
 * collection that started it. Empty and failed are different outcomes: a miss
 * does not walk the page backward, and a failure is not stored as zero matches.
 * Query and filter changes return to page 1. Changing the view does not.
 */

export type SearchPhase = "initial" | "refreshing" | "ready" | "empty" | "error";

export type SearchToken = {
  generation: number;
  collectionId: string | null;
};

export function createSearchGate() {
  let generation = 0;
  let collectionId: string | null = null;

  function token(): SearchToken {
    return { generation, collectionId };
  }

  return {
    token,
    collectionId: () => collectionId,
    /**
     * The selected collection changed. Every in-flight search is stale, including
     * one that has not settled yet. Calling again with the same id still
     * invalidates in-flight work so a late payload cannot repaint this collection.
     */
    changeCollection(next: string | null): SearchToken {
      generation += 1;
      collectionId = next;
      return token();
    },
    /** Same collection, newer request. The previous response must not apply. */
    begin(): SearchToken {
      generation += 1;
      return token();
    },
    accepts(request: SearchToken): boolean {
      return request.generation === generation && request.collectionId === collectionId;
    },
  };
}

export type SearchChange = "query" | "filter" | "page" | "pageSize" | "view" | "retry";

/** Page to request after a person changes search state. View and retry keep the page. */
export function pageAfterChange(page: number, change: SearchChange): number {
  const current = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  if (change === "query" || change === "filter" || change === "pageSize") {
    return 1;
  }
  return current;
}

export type LookupRef = {
  id: string;
  name: string;
};

/**
 * Keep selections whose ids exist in the current collection's lookup.
 * Missing ids are incompatible and must not be sent or shown.
 */
export function compatibleSelections<T extends LookupRef>(
  requestedIds: readonly string[],
  available: readonly T[]
): {
  kept: T[];
  droppedIds: string[];
} {
  const byId = new Map(available.map(item => [item.id, item]));
  const kept: T[] = [];
  const droppedIds: string[] = [];
  const seen = new Set<string>();

  for (const id of requestedIds) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const match = byId.get(id);
    if (match) {
      kept.push(match);
    } else {
      droppedIds.push(id);
    }
  }

  return { kept, droppedIds };
}

export function compatibleFieldFilters(
  fields: readonly (readonly [string, string])[],
  availableFields: readonly string[]
): [string, string][] {
  const names = new Set(availableFields);
  return fields.filter((tuple): tuple is [string, string] => {
    const name = tuple[0];
    if (!name) {
      return true;
    }
    return names.has(name);
  });
}

export type SearchFilterState = {
  locations: LookupRef[];
  tags: LookupRef[];
  includeArchived: boolean;
  onlyWithPhoto: boolean;
  onlyWithoutPhoto: boolean;
  negateTags: boolean;
  orderBy: string;
  fields: Array<{ field: string; value: string }>;
};

export type SearchChipKind =
  "location" | "tag" | "archived" | "with-photo" | "without-photo" | "negate-tags" | "order" | "field";

export type SearchChip = {
  key: string;
  kind: SearchChipKind;
  id?: string;
  label: string;
};

export type SearchChipLabels = {
  archived: string;
  withPhoto: string;
  withoutPhoto: string;
  negateTags: string;
  order: (order: string) => string;
  field: (field: string, value: string) => string;
};

const DEFAULT_ORDER = "name";

export function appliedFieldFilters(
  fields: readonly (readonly [string, string])[]
): Array<{ field: string; value: string }> {
  return fields.flatMap(tuple => {
    const field = tuple[0]?.trim() ?? "";
    const value = tuple[1]?.trim() ?? "";
    if (!field || !value) {
      return [];
    }
    return [{ field, value }];
  });
}

/** Options are active only when they change the request, not when a selector is merely open. */
export function optionsAreActive(state: SearchFilterState): boolean {
  return (
    state.includeArchived ||
    state.onlyWithPhoto ||
    state.onlyWithoutPhoto ||
    state.negateTags ||
    (state.orderBy !== "" && state.orderBy !== DEFAULT_ORDER) ||
    state.fields.some(field => field.field.trim() !== "" && field.value.trim() !== "")
  );
}

export function searchChips(state: SearchFilterState, labels: SearchChipLabels): SearchChip[] {
  const chips: SearchChip[] = [];

  for (const location of state.locations) {
    chips.push({
      key: `location:${location.id}`,
      kind: "location",
      id: location.id,
      label: location.name,
    });
  }
  for (const tag of state.tags) {
    chips.push({
      key: `tag:${tag.id}`,
      kind: "tag",
      id: tag.id,
      label: tag.name,
    });
  }
  if (state.includeArchived) {
    chips.push({ key: "archived", kind: "archived", label: labels.archived });
  }
  if (state.onlyWithPhoto) {
    chips.push({ key: "with-photo", kind: "with-photo", label: labels.withPhoto });
  }
  if (state.onlyWithoutPhoto) {
    chips.push({ key: "without-photo", kind: "without-photo", label: labels.withoutPhoto });
  }
  if (state.negateTags) {
    chips.push({ key: "negate-tags", kind: "negate-tags", label: labels.negateTags });
  }
  if (state.orderBy && state.orderBy !== DEFAULT_ORDER) {
    chips.push({ key: "order", kind: "order", id: state.orderBy, label: labels.order(state.orderBy) });
  }
  for (const field of state.fields) {
    chips.push({
      key: `field:${field.field}=${field.value}`,
      kind: "field",
      id: `${field.field}=${field.value}`,
      label: labels.field(field.field, field.value),
    });
  }

  return chips;
}

export type SearchOutcome<T> = { ok: true; items: T[]; total: number } | { ok: false };

export type SearchSnapshot<T> = {
  items: T[];
  total: number;
  phase: SearchPhase;
  collectionId: string | null;
};

export type AppliedSearch<T> = {
  accepted: boolean;
  snapshot: SearchSnapshot<T> | null;
  page: number;
  refetch: boolean;
};

/**
 * Apply a list response.
 * A stale token leaves the snapshot unset so the caller keeps whatever the
 * newer request already showed. A failure does not decrement the page.
 * An empty page past the end is clamped once; a genuine miss stays on page 1
 * without another request.
 */
export function applySearchResponse<T>(args: {
  accepts: boolean;
  outcome: SearchOutcome<T>;
  requestedPage: number;
  pageSize: number;
  collectionId: string | null;
}): AppliedSearch<T> {
  const requestedPage = Number.isFinite(args.requestedPage) ? Math.max(1, Math.trunc(args.requestedPage)) : 1;
  if (!args.accepts) {
    return { accepted: false, snapshot: null, page: requestedPage, refetch: false };
  }

  if (!args.outcome.ok) {
    return {
      accepted: true,
      snapshot: { items: [], total: 0, phase: "error", collectionId: args.collectionId },
      page: requestedPage,
      refetch: false,
    };
  }

  const pageSize = Number.isFinite(args.pageSize) && args.pageSize > 0 ? Math.trunc(args.pageSize) : 1;
  const total = Number.isFinite(args.outcome.total) ? Math.max(0, Math.trunc(args.outcome.total)) : 0;
  const items = args.outcome.items ?? [];

  if (items.length === 0 && total > 0) {
    const last = Math.max(1, Math.ceil(total / pageSize));
    if (requestedPage > last) {
      return { accepted: true, snapshot: null, page: last, refetch: true };
    }
  }

  if (items.length === 0 && total === 0) {
    return {
      accepted: true,
      snapshot: { items: [], total: 0, phase: "empty", collectionId: args.collectionId },
      page: 1,
      refetch: false,
    };
  }

  return {
    accepted: true,
    snapshot: {
      items,
      total,
      phase: "ready",
      collectionId: args.collectionId,
    },
    page: requestedPage,
    refetch: false,
  };
}

export function paginationCounts(
  page: number,
  pageSize: number,
  total: number
): {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 1;
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  return { page: safePage, pageSize: safeSize, total: safeTotal, totalPages };
}

/** Phase to show while a request is in flight. The first load is not a refresh. */
export function phaseWhileLoading(previous: SearchPhase): "initial" | "refreshing" {
  return previous === "initial" ? "initial" : "refreshing";
}
