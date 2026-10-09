import { useI18n } from "vue-i18n";
import type { UserClient } from "~~/lib/api/user";

export type StatKey = "value" | "items" | "locations" | "tags";

type StatCard = {
  key: StatKey;
  label: string;
  value: number;
  type: "currency" | "number";
};

export function statCardData(api: UserClient) {
  const { t } = useI18n();

  const { data: statistics } = useAsyncData(
    "statistics",
    async () => {
      const { data } = await api.stats.group();
      return data;
    },
    {
      deep: true,
    }
  );

  return computed(() => {
    return [
      {
        key: "value",
        label: t("home.total_value"),
        value: statistics.value?.totalItemPrice || 0,
        type: "currency",
      },
      {
        key: "items",
        label: t("home.total_items"),
        value: statistics.value?.totalItems || 0,
        type: "number",
      },
      {
        key: "locations",
        label: t("home.total_locations"),
        value: statistics.value?.totalLocations || 0,
        type: "number",
      },
      {
        key: "tags",
        label: t("home.total_tags"),
        value: statistics.value?.totalTags || 0,
        type: "number",
      },
    ] as StatCard[];
  });
}
