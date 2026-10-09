import type { EntitySummary } from "../api/types/data-contracts";

// Explicit record fields matching the dashboard table, not aggregate statistics.
export const reportingColumns = [
  {
    id: "assetId",
    label: "items.asset_id",
    value: (item: EntitySummary) => item.assetId,
  },
  {
    id: "name",
    label: "items.name",
    value: (item: EntitySummary) => item.name,
  },
  {
    id: "quantity",
    label: "items.quantity",
    value: (item: EntitySummary) => item.quantity,
  },
  {
    id: "insured",
    label: "items.insured",
    value: (item: EntitySummary) => item.insured,
  },
  {
    id: "purchasePrice",
    label: "items.purchase_price",
    value: (item: EntitySummary) => item.purchasePrice,
  },
  {
    id: "location",
    label: "items.location",
    value: (item: EntitySummary) => item.parent?.name,
  },
  {
    id: "archived",
    label: "items.archived",
    value: (item: EntitySummary) => item.archived,
  },
  {
    id: "createdAt",
    label: "items.created_at",
    value: (item: EntitySummary) => item.createdAt,
  },
  {
    id: "updatedAt",
    label: "items.updated_at",
    value: (item: EntitySummary) => item.updatedAt,
  },
] as const;

export type ReportingColumnId = (typeof reportingColumns)[number]["id"];
export const defaultReportingColumns: ReportingColumnId[] = ["name", "quantity", "insured", "purchasePrice"];

export function selectedReportingColumns(selected: readonly string[]) {
  return reportingColumns.filter(column => selected.includes(column.id));
}

export function reportingExportUnavailable(loading: boolean, count: number) {
  return loading ? "home.csv.loading" : count === 0 ? "home.csv.empty" : undefined;
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && (/^\s*[=+\-@＝＋－＠]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportingCsv(items: readonly EntitySummary[], selected: readonly string[], t: (key: string) => string) {
  const columns = selectedReportingColumns(selected);
  if (!columns.length) throw new Error("At least one column must be selected");
  return [
    columns.map(column => csvCell(t(column.label))).join(","),
    ...items.map(item => columns.map(column => csvCell(column.value(item))).join(",")),
  ].join("\r\n");
}
