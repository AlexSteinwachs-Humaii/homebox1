import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from "@tanstack/vue-table";
import type { EntitySummary } from "../api/types/data-contracts";
import { captureReportingView, reportingViewIsCurrent, downloadReportingCsv, type ReportingView } from "./export";
import { reportingCsv } from "./csv";

const items = ["Zulu", "Bravo", "Alpha", "Excluded"].map((name, i) => ({
  id: String(i),
  name,
  quantity: i,
})) as EntitySummary[];
const view = (): ReportingView => ({
  items,
  loading: false,
  collectionId: "a",
  activeCollectionId: "a",
});

describe("displayed reporting scope", () => {
  it("exports the filtered, sorted current page rather than the fetched collection", () => {
    const table = createTable<EntitySummary>({
      data: items,
      columns: [
        {
          accessorKey: "name",
          filterFn: row => row.original.name !== "Excluded",
        },
      ],
      state: {
        columnFilters: [{ id: "name", value: true }],
        sorting: [{ id: "name", desc: false }],
        pagination: { pageIndex: 0, pageSize: 2 },
      },
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      onStateChange: () => {},
      renderFallbackValue: null,
    });
    const visible = table.getRowModel().rows.map(row => row.original);
    expect(reportingCsv(visible, ["quantity", "name"], key => key)).toBe(
      '"items.name","items.quantity"\r\n"Alpha","2"\r\n"Bravo","1"'
    );
    expect(items).toHaveLength(4);
  });

  it("rejects collection switches even before results refresh and old responses after switching", () => {
    const snapshot = captureReportingView(view());
    expect(reportingViewIsCurrent(snapshot, view())).toBe(true);
    expect(reportingViewIsCurrent(snapshot, { ...view(), activeCollectionId: "b" })).toBe(false);
    expect(captureReportingView({ ...view(), activeCollectionId: "b" })).toBeUndefined();
    expect(
      reportingViewIsCurrent(snapshot, {
        ...view(),
        collectionId: "b",
        activeCollectionId: "b",
      })
    ).toBe(false);
  });

  it("rejects refresh, changed pages, order, filters and in-place edits", () => {
    const snapshot = captureReportingView(view());
    for (const changed of [
      { ...view(), loading: true },
      { ...view(), items: [] },
      { ...view(), items: items.slice(1) },
      { ...view(), items: [...items].reverse() },
      {
        ...view(),
        items: [{ ...items[0], name: "Changed" } as EntitySummary, ...items.slice(1)],
      },
    ])
      expect(reportingViewIsCurrent(snapshot, changed)).toBe(false);
    expect(reportingViewIsCurrent(undefined, view())).toBe(false);
  });
});

describe("browser download", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function browser(fail = false) {
    vi.useFakeTimers();
    const link = {
      href: "",
      download: "",
      click: vi.fn(() => {
        if (fail) throw new Error("download failed");
      }),
      remove: vi.fn(),
    };
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => link),
      body: { appendChild: vi.fn() },
    });
    return { link, createObjectURL, revokeObjectURL };
  }

  it("downloads UTF-8 CSV with a descriptive filename and releases resources without changing records", async () => {
    const { link, createObjectURL, revokeObjectURL } = browser();
    const before = JSON.stringify(items);
    downloadReportingCsv(items.slice(0, 1), ["name"], key => key);
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(await blob.text()).toBe('"items.name"\r\n"Zulu"');
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([239, 187, 191]);
    expect(link.download).toMatch(/^homebox-recently-added-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    expect(JSON.stringify(items)).toBe(before);
  });

  it("propagates download failures for the selector retry path and cleans up", () => {
    const { link, revokeObjectURL } = browser(true);
    expect(() => downloadReportingCsv(items, ["name"], key => key)).toThrow("download failed");
    expect(link.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    browser();
    expect(() => downloadReportingCsv(items, ["name"], key => key)).not.toThrow();
  });
});
