/**
 * Featured belongings on the Purrfect Home overview.
 *
 * The home page already asks for recent items with page 1, page size 5 and
 * orderBy createdAt. The backend returns that page newest-first. The featured
 * subset is the first records of that response, in that order.
 *
 * Do not filter by name, tag or pet, do not re-sort, and do not invent a
 * record when the page is shorter than the limit.
 */
export const FEATURED_BELONGING_LIMIT = 3;

export function featuredBelongings<T>(items: readonly T[], limit = FEATURED_BELONGING_LIMIT): T[] {
  if (!Number.isFinite(limit) || limit <= 0) {
    return [];
  }
  return items.slice(0, Math.floor(limit));
}
