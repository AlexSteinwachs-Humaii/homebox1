import type { EntitySummary } from "../api/types/data-contracts";
import { reportingCsv } from "./csv";

export type ReportingView = {
  items: readonly EntitySummary[];
  loading: boolean;
  collectionId: string | null | undefined;
  activeCollectionId: string | null;
};

function viewKey(view: ReportingView) {
  return JSON.stringify([view.collectionId, view.items]);
}

export function captureReportingView(view: ReportingView): string | undefined {
  if (view.loading || !view.items.length || view.collectionId !== view.activeCollectionId) return;
  return viewKey(view);
}

export function reportingViewIsCurrent(snapshot: string | undefined, view: ReportingView): boolean {
  return snapshot !== undefined && snapshot === captureReportingView(view);
}

// Synchronous generation from the displayed page only; no API calls or dashboard mutations.
export function downloadReportingCsv(
  items: readonly EntitySummary[],
  selected: readonly string[],
  t: (key: string) => string
) {
  const csv = reportingCsv(items, selected, t);
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement("a");
    link.href = url;
    link.download = `homebox-recently-added-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
  } finally {
    link?.remove();
    // Allow the browser to consume the URL before revoking it, including on failure.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
