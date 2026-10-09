import { afterEach, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import type { EntitySummary } from "../../lib/api/types/data-contracts";
import { itemsTable } from "./table";

afterEach(() => vi.unstubAllGlobals());

it("binds the displayed page to its request collection and hides late cross-collection responses", async () => {
  const preferences = ref({ collectionId: "a" });
  const data = ref<{ items: EntitySummary[]; collectionId: string | null }>();
  const status = ref("pending");
  let fetchPage!: () => Promise<{
    items: EntitySummary[];
    collectionId: string | null;
  }>;
  let watched: unknown;
  const records = [{ id: "a1", name: "Allowed" }] as EntitySummary[];
  const getAll = vi.fn(async () => ({
    data: {
      items:
        preferences.value.collectionId === "a"
          ? records
          : ([{ id: "b1", name: "Other allowed record" }] as EntitySummary[]),
    },
  }));
  const tenants: string[] = [];
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useViewPreferences", () => preferences);
  vi.stubGlobal("useUserApi", () => {
    tenants.push(preferences.value.collectionId);
    return { items: { getAll } };
  });
  vi.stubGlobal("useAsyncData", (_key: string, handler: typeof fetchPage, options: { watch: unknown }) => {
    fetchPage = handler;
    watched = options.watch;
    return { data, status, refresh: vi.fn() };
  });
  vi.stubGlobal("ServerEvent", { EntityMutation: "mutation" });
  vi.stubGlobal("onServerEvent", vi.fn());
  const table = itemsTable();
  expect(table.value.loading).toBe(true);
  const pending = fetchPage();
  preferences.value.collectionId = "b";
  data.value = await pending;
  status.value = "success";
  expect(table.value.items).toEqual([]);
  expect(table.value.loading).toBe(true);
  expect(getAll).toHaveBeenCalledExactlyOnceWith({
    page: 1,
    pageSize: 5,
    orderBy: "createdAt",
  });
  expect(tenants).toEqual(["a"]);
  expect(watched).toHaveLength(1);
  data.value = await fetchPage();
  expect(tenants).toEqual(["a", "b"]);
  expect(table.value.collectionId).toBe("b");
  expect(table.value.items.map(item => item.id)).toEqual(["b1"]);
  expect(table.value.loading).toBe(false);
});
