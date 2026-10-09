/**
 * Collection-scoped overview loading.
 *
 * Counts and records are shown only after a response for the current
 * collection is accepted. A later response for an earlier collection, or for
 * an earlier refresh of this collection, is ignored. Pending and failed
 * loads are not zeros.
 */

export type OverviewStatus = "pending" | "ready" | "error";

export type OverviewSource = "statistics" | "items";

export type RequestToken = {
  generation: number;
  collectionId: string | null;
};

export type GroupStatisticNumbers = {
  totalItemPrice: number;
  totalItems: number;
  totalLocations: number;
  totalTags: number;
};

export function overviewCacheKey(source: OverviewSource, collectionId: string | null): string {
  return `home:${source}:${collectionId ?? "unselected"}`;
}

export function createOverviewGate() {
  let generation = 0;
  let collectionId: string | null = null;

  function token(): RequestToken {
    return { generation, collectionId };
  }

  return {
    token,
    /**
     * Move the gate to this collection. In-flight work for any other
     * generation is no longer current. Calling again with the same id does
     * not invalidate a request that already captured this generation.
     */
    changeCollection(next: string | null): RequestToken {
      if (next !== collectionId) {
        generation += 1;
        collectionId = next;
      }
      return token();
    },
    /** Same collection, newer request. The previous response must not apply. */
    refresh(): RequestToken {
      generation += 1;
      return token();
    },
    accepts(request: RequestToken): boolean {
      return request.generation === generation && request.collectionId === collectionId;
    },
  };
}

export type OverviewOutcome<T> = { ok: true; data: T } | { ok: false };

export type OverviewSnapshot<T> = {
  data: T | null;
  status: OverviewStatus;
};

/**
 * Apply a response only when its token is still current.
 * A stale response leaves the snapshot untouched so a previous collection
 * cannot reappear, and a failed current response is not stored as data.
 */
export function applyOverviewResult<T>(
  accepts: boolean,
  outcome: OverviewOutcome<T>,
  current: OverviewSnapshot<T>
): OverviewSnapshot<T> {
  if (!accepts) {
    return current;
  }
  if (!outcome.ok) {
    return { data: null, status: "error" };
  }
  return { data: outcome.data, status: "ready" };
}

export function viewState(status: string | null | undefined): OverviewStatus {
  if (status === "ready") {
    return "ready";
  }
  if (status === "error") {
    return "error";
  }
  return "pending";
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

/**
 * Accept a statistics payload only when every displayed total is a real
 * number. Missing fields are not zeros. A successful payload may contain
 * zeros.
 */
export function parseGroupStatistics(value: unknown): GroupStatisticNumbers | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const totalItemPrice = finiteNumber(record.totalItemPrice);
  const totalItems = finiteNumber(record.totalItems);
  const totalLocations = finiteNumber(record.totalLocations);
  const totalTags = finiteNumber(record.totalTags);
  if (totalItemPrice === null || totalItems === null || totalLocations === null || totalTags === null) {
    return null;
  }
  return { totalItemPrice, totalItems, totalLocations, totalTags };
}

/** Locale formatting already used for currency, applied to count totals. */
export function formatStatNumber(value: number, locale: string): string {
  const safeLocale = locale.trim() || "en-US";
  return new Intl.NumberFormat(safeLocale).format(value);
}
