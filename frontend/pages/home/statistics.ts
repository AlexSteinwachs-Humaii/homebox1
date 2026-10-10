import { useI18n } from "vue-i18n";
import type { UserClient } from "~~/lib/api/user";
import { parseGroupStatistics } from "./overview-state";
import { useOverviewResource } from "./load";

export type StatKey = "value" | "items" | "locations" | "tags";

export type StatCard = {
  key: StatKey;
  label: string;
  value: number;
  type: "currency" | "number";
};

async function loadStatistics(api: UserClient) {
  const result = await api.stats.group();
  const parsed = result.error ? null : parseGroupStatistics(result.data);
  if (!parsed) {
    return { ok: false as const };
  }
  return { ok: true as const, data: parsed };
}

export function statCardData() {
  const { t } = useI18n();
  const statistics = useOverviewResource("statistics", loadStatistics, { entity: true, tag: true });

  const cards = computed<StatCard[]>(() => {
    if (statistics.status.value !== "ready" || !statistics.data.value) {
      return [];
    }
    const totals = statistics.data.value;
    return [
      {
        key: "value",
        label: t("home.total_value"),
        value: totals.totalItemPrice,
        type: "currency",
      },
      {
        key: "items",
        label: t("home.total_items"),
        value: totals.totalItems,
        type: "number",
      },
      {
        key: "locations",
        label: t("home.total_locations"),
        value: totals.totalLocations,
        type: "number",
      },
      {
        key: "tags",
        label: t("home.total_tags"),
        value: totals.totalTags,
        type: "number",
      },
    ];
  });

  return {
    cards,
    status: statistics.status,
    refresh: statistics.refresh,
  };
}
