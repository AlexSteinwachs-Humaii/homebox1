import type { UserClient } from "~~/lib/api/user";
import type { EntitySummary } from "~~/lib/api/types/data-contracts";
import { useOverviewResource } from "./load";

async function loadRecentItems(api: UserClient) {
  const result = await api.items.getAll({
    page: 1,
    pageSize: 5,
    orderBy: "createdAt",
  });
  if (result.error || !Array.isArray(result.data?.items)) {
    return { ok: false as const };
  }
  return { ok: true as const, data: result.data.items as EntitySummary[] };
}

export function itemsTable() {
  const recent = useOverviewResource("items", loadRecentItems, {
    entity: true,
  });

  return {
    items: computed(() => (recent.status.value === "ready" ? (recent.data.value ?? []) : [])),
    status: recent.status,
    collectionId: recent.collectionId,
    loading: computed(() => recent.status.value !== "ready"),
    refresh: recent.refresh,
  };
}
