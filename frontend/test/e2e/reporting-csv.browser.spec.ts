import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const group = { id: "csv-test-group", name: "CSV Test", currency: "USD" };
const item = {
  id: "csv-test-item",
  name: "Drill",
  assetId: "000042",
  quantity: 2,
  insured: true,
  purchasePrice: 129,
  archived: false,
  tags: [],
  createdAt: "2026-10-09T12:00:00Z",
  updatedAt: "2026-10-09T12:00:00Z",
};

async function dashboard(page: Page, empty = false, waitForRecords?: Promise<void>) {
  await page.context().addCookies([{ name: "hb.auth.session", value: "true", url: test.info().project.use.baseURL! }]);
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.endsWith("/status"))
      body = { build: { version: "v1.0.0", commit: "test" }, latest: { version: "v1.0.0" } };
    else if (path.endsWith("/users/self"))
      body = { item: { id: "csv-user", name: "CSV User", group, email: "csv@example.com" } };
    else if (path.endsWith("/users/self/settings")) body = { item: {} };
    else if (path.endsWith("/groups/all")) body = [group];
    else if (path.endsWith("/groups")) body = group;
    else if (path.endsWith("/groups/statistics"))
      body = { totalItems: 1, totalLocations: 0, totalTags: 0, totalPrice: 129 };
    else if (path.endsWith("/entities")) {
      await waitForRecords;
      body = { items: empty ? [] : [item], total: empty ? 0 : 1, page: 1, pageSize: 5 };
    }
    await route.fulfill({ json: body });
  });
  await page.goto("/home");
}

test("select columns, validate empty selection, and download in selector order", async ({ page }) => {
  await dashboard(page);
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox")).toHaveCount(9);
  await expect(dialog.getByRole("checkbox", { name: "Name", exact: true })).toBeChecked();
  for (const name of ["Name", "Quantity", "Insured", "Purchase Price"]) {
    await dialog.getByRole("checkbox", { name, exact: true }).uncheck();
  }
  await expect(dialog.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await expect(dialog.getByText("Select at least one column to download a CSV.")).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Quantity", exact: true }).check();
  const nameCheckbox = dialog.getByRole("checkbox", { name: "Name", exact: true });
  await nameCheckbox.focus();
  await page.keyboard.press("Space");
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).toBe('\uFEFF"Name","Quantity"\r\n"Drill","2"');
  await expect(dialog).toBeHidden();
});

test("cancel and Escape dismiss without a download or changing results", async ({ page }) => {
  await dashboard(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  const exportButton = page.getByRole("button", { name: "Export CSV", exact: true });
  await exportButton.click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await exportButton.click();
  await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Name", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(exportButton).toBeFocused();
  await expect(page.getByRole("table").getByText("Drill", { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await expect(page).toHaveURL(/\/home\/?$/);
});

test("loading and empty results explain why export is unavailable", async ({ page }) => {
  let release!: () => void;
  const recordsReady = new Promise<void>(resolve => {
    release = resolve;
  });
  await dashboard(page, true, recordsReady);
  const exportButton = page.getByRole("button", { name: "Export CSV", exact: true });
  await expect(exportButton).toBeDisabled();
  await expect(page.getByText("CSV export is unavailable while records are loading.")).toBeVisible();
  release();
  await expect(page.getByText("No records are visible to export.")).toBeVisible();
  await expect(exportButton).toBeDisabled();
});
