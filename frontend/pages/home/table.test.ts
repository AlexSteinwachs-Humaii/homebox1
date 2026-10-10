import { afterEach, expect, it, vi } from "vitest";
import { computed, ref, watch } from "vue";
import type { EntitySummary } from "../../lib/api/types/data-contracts";
import { itemsTable } from "./table";

vi.mock("~~/composables/use-collections", () => ({
  activeCollectionId: () => null,
}));
vi.mock("@/composables/use-server-events", () => ({
  ServerEvent: { EntityMutation: "mutation" },
  onServerEvent: vi.fn(),
}));
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const preferences = ref({ collectionId: "a" });
  const getAll = vi.fn();
  let fetchPage!: () => Promise<unknown>;
  const refresh = vi.fn(() => fetchPage());
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useCollections", () => ({ selectedId: ref(null) }));
  vi.stubGlobal("useViewPreferences", () => preferences);
  vi.stubGlobal("useUserApi", () => ({ items: { getAll } }));
  vi.stubGlobal("useAsyncData", (_key: unknown, handler: typeof fetchPage) => {
    fetchPage = handler;
    return { refresh };
  });
  const table = itemsTable();
  return { preferences, getAll, table, fetchPage };
}

it("binds displayed/exported records to their collection and ignores late responses", async () => {
  const { preferences, getAll, table, fetchPage } = setup();
  let resolveA!: (value: unknown) => void;
  getAll.mockReturnValueOnce(new Promise(resolve => (resolveA = resolve)));
  expect(table.loading.value).toBe(true);
  const pendingA = fetchPage();
  preferences.value.collectionId = "b";
  expect(table.items.value).toEqual([]);
  expect(table.collectionId.value).toBe("b");
  getAll.mockResolvedValueOnce({
    data: { items: [{ id: "b1", name: "Allowed" }] as EntitySummary[] },
  });
  await fetchPage();
  resolveA({ data: { items: [{ id: "a1", name: "Old collection" }] } });
  await pendingA;
  expect(table.items.value.map(item => item.id)).toEqual(["b1"]);
  expect(table.loading.value).toBe(false);
  expect(getAll).toHaveBeenCalledWith({
    page: 1,
    pageSize: 5,
    orderBy: "createdAt",
  });
});

it("disables export during refresh and keeps errors distinct from a successful empty result", async () => {
  const { getAll, table, fetchPage } = setup();
  getAll.mockResolvedValueOnce({
    data: { items: [{ id: "a1", name: "Allowed" }] },
  });
  await fetchPage();
  expect(table.status.value).toBe("ready");
  getAll.mockResolvedValueOnce({ error: new Error("Unavailable") });
  const refresh = table.refresh();
  expect(table.loading.value).toBe(true);
  expect(table.items.value).toEqual([]);
  await refresh;
  expect(table.status.value).toBe("error");
  expect(table.loading.value).toBe(true);
  getAll.mockResolvedValueOnce({ data: { items: [] } });
  await table.refresh();
  expect(table.status.value).toBe("ready");
  expect(table.loading.value).toBe(false);
  expect(table.items.value).toEqual([]);
});

it("ignores an older response after a newer refresh has settled", async () => {
  const { getAll, table, fetchPage } = setup();
  let resolveOld!: (value: unknown) => void;
  getAll.mockReturnValueOnce(new Promise(resolve => (resolveOld = resolve)));
  const old = fetchPage();
  getAll.mockResolvedValueOnce({
    data: { items: [{ id: "new", name: "New" }] },
  });
  await table.refresh();
  resolveOld({ data: { items: [{ id: "old", name: "Old" }] } });
  await old;
  expect(table.items.value.map(item => item.id)).toEqual(["new"]);
});
