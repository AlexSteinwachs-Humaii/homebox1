import { describe, expect, it } from "vitest";
import type { EntitySummary } from "../api/types/data-contracts";
import {
  defaultReportingColumns,
  reportingColumns,
  reportingCsv,
  reportingExportUnavailable,
  selectedReportingColumns,
} from "./csv";

const record = {
  assetId: "000042",
  name: "Drill",
  quantity: 2,
  insured: true,
  purchasePrice: 129,
  archived: false,
  createdAt: "2026-10-09",
  updatedAt: "2026-10-09",
  parent: { name: "Garage" },
} as EntitySummary;
const label = (key: string) => key;

describe("reporting column selection", () => {
  it("offers only supported record columns, with the table's initial defaults", () => {
    expect(reportingColumns.map(column => column.id)).toEqual([
      "assetId",
      "name",
      "quantity",
      "insured",
      "purchasePrice",
      "location",
      "archived",
      "createdAt",
      "updatedAt",
    ]);
    expect(defaultReportingColumns).toEqual(["name", "quantity", "insured", "purchasePrice"]);
    expect(reportingColumns.every(column => column.label.startsWith("items."))).toBe(true);
  });

  it("exports selected columns in selector order, not click order", () => {
    expect(selectedReportingColumns(["quantity", "name", "totalValue"]).map(column => column.id)).toEqual([
      "name",
      "quantity",
    ]);
    expect(reportingCsv([record], ["quantity", "name"], label)).toBe('"items.name","items.quantity"\r\n"Drill","2"');
  });

  it("supports deselection and refuses an empty or unsupported selection", () => {
    expect(reportingCsv([record], ["quantity"], label)).toBe('"items.quantity"\r\n"2"');
    expect(() => reportingCsv([record], [], label)).toThrow("At least one column");
    expect(() => reportingCsv([record], ["totalItems"], label)).toThrow("At least one column");
  });

  it("explains loading and empty results, including refreshes with previous data", () => {
    expect(reportingExportUnavailable(true, 5)).toBe("home.csv.loading");
    expect(reportingExportUnavailable(true, 0)).toBe("home.csv.loading");
    expect(reportingExportUnavailable(false, 0)).toBe("home.csv.empty");
    expect(reportingExportUnavailable(false, 5)).toBeUndefined();
  });

  it("does not change source records or the selected columns", () => {
    const items = structuredClone([record]);
    const before = structuredClone(items);
    const selection = ["name", "location"];
    expect(reportingCsv(items, selection, label)).toContain('"Drill","Garage"');
    expect(items).toEqual(before);
    expect(selection).toEqual(["name", "location"]);
  });

  it.each(["=SUM(1,2)", "+1+1", "-1+1", "@SUM(A1)", "  =1", "\tplain", "\rplain", "\nplain", "＝1"])(
    "neutralizes spreadsheet text %j without altering numeric values",
    name => {
      expect(reportingCsv([{ ...record, name, purchasePrice: -12 }], ["name", "purchasePrice"], label)).toContain(
        `"'${name}","-12"`
      );
    }
  );

  it("writes missing fields as empty cells and quotes text safely", () => {
    const item = { ...record, name: 'Drill, "big"\n工具', parent: undefined };
    expect(reportingCsv([item], ["name", "location"], label)).toContain('"Drill, ""big""\n工具",""');
    expect(reportingCsv([{ ...record, name: "=1+1" }], ["name"], label)).toContain('"\'=1+1"');
  });
});
