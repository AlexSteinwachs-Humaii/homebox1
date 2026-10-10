import { expect, test, type Page, type Route } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

const ANNEX = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PAINT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const RACK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const BIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const SPARE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5";
const LOFT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6";
const ATTIC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7";
const CRATE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8";
const NAILS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9";
const LAMP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10";
const BRUSH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11";
const BULB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12";
const PHOTO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13";
const TRAVEL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14";
const HARDWARE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15";
const PAGE_ROOM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16";
const LOC_TYPE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17";
const ITEM_TYPE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

type ParentQuery = { parentIds: string[]; page: number; pageSize: number };

function locationSummary(id: string, name: string, parentId: string | null, itemCount = 0) {
  return {
    id,
    name,
    description: "",
    quantity: 1,
    purchasePrice: 0,
    archived: false,
    insured: false,
    assetId: "000-000",
    tags: [],
    createdAt: "2026-01-08T12:00:00Z",
    updatedAt: "2026-03-02T12:00:00Z",
    parent: parentId ? { id: parentId, name: parentId } : null,
    entityType: { id: LOC_TYPE, name: "Place", color: "#888888", isLocation: true },
    itemCount,
  };
}

function itemRow(args: {
  id: string;
  name: string;
  parentId: string;
  quantity: number;
  purchasePrice: number;
  imageId?: string | null;
  tags?: Array<{ id: string; name: string }>;
}) {
  return {
    id: args.id,
    name: args.name,
    description: "",
    quantity: args.quantity,
    purchasePrice: args.purchasePrice,
    archived: false,
    insured: false,
    assetId: "000-000",
    imageId: args.imageId ?? null,
    thumbnailId: args.imageId ?? null,
    tags: args.tags ?? [],
    parent: { id: args.parentId, name: args.parentId },
    createdAt: "2026-01-08T12:00:00Z",
    updatedAt: "2026-03-02T12:00:00Z",
    entityType: { id: ITEM_TYPE, name: "Item", color: "#888888", isLocation: false },
    itemCount: 99,
  };
}

const locations = [
  locationSummary(ANNEX, "Annex", null),
  locationSummary(PAINT, "Paint", ANNEX, 99),
  locationSummary(RACK, "High rack", PAINT),
  locationSummary(BIN, "Left bin", RACK),
  locationSummary(SPARE, "Spare bins", ANNEX),
  locationSummary(LOFT, "North loft", null),
  locationSummary(ATTIC, "Attic cupboard", null),
  locationSummary(PAGE_ROOM, "Paged closet", null),
];

const belongings = [
  itemRow({ id: BULB, name: "Loose bulb", parentId: ANNEX, quantity: 2, purchasePrice: 8 }),
  itemRow({
    id: CRATE,
    name: "Crate",
    parentId: RACK,
    quantity: 1,
    purchasePrice: 15,
    imageId: PHOTO,
    tags: [{ id: TRAVEL, name: "Travel" }],
  }),
  itemRow({
    id: NAILS,
    name: "Nails",
    parentId: CRATE,
    quantity: 1.5,
    purchasePrice: 3,
    tags: [{ id: HARDWARE, name: "Hardware" }],
  }),
  itemRow({ id: LAMP, name: "Lamp", parentId: BIN, quantity: 1, purchasePrice: 22 }),
  itemRow({ id: BRUSH, name: "Brush", parentId: SPARE, quantity: 4, purchasePrice: 9 }),
  itemRow({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19",
    name: "Attic screw",
    parentId: ATTIC,
    quantity: 0.5,
    purchasePrice: 1.25,
  }),
  itemRow({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20",
    name: "Attic cloth",
    parentId: ATTIC,
    quantity: 1,
    purchasePrice: 6,
    imageId: PHOTO,
    tags: [{ id: TRAVEL, name: "Travel" }],
  }),
  ...Array.from({ length: 12 }, (_, index) =>
    itemRow({
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
      name: `Paged belonging ${index + 1}`,
      parentId: PAGE_ROOM,
      quantity: 1,
      purchasePrice: index + 1,
    })
  ),
];

function entityOut(id: string, name: string, children: unknown[] = []) {
  return {
    ...locationSummary(id, name, null),
    notes: "",
    attachments: [],
    children,
    fields: [],
    description: "",
    totalPrice: 0,
    lifetimeWarranty: false,
    manufacturer: "",
    modelNumber: "",
    serialNumber: "",
    soldDate: "0001-01-01T00:00:00Z",
    soldPrice: 0,
    soldTo: "",
    soldNotes: "",
    warrantyExpires: "0001-01-01T00:00:00Z",
    warrantyDetails: "",
    syncChildEntityLocations: false,
    purchaseDate: "0001-01-01T00:00:00Z",
    purchaseFrom: "",
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function login(page: Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const email = page.locator("input[type='email'], input[type='text']").first();
  await email.waitFor({ state: "visible" });
  await email.fill(DEMO_EMAIL);
  await page.fill("input[type='password']", DEMO_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL("/home");
}

async function choosePurrfect(page: Page) {
  await page.goto("/profile");
  await page.locator("[data-set-theme='purrfect-home']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purrfect-home");
}

function installRoutes(page: Page, queries: ParentQuery[]) {
  return page.route("**/api/v1/entities**", async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (method !== "GET") {
      await route.continue();
      return;
    }
    if (path.endsWith("/tree") || path.endsWith("/export") || path.includes("/attachments/")) {
      await route.continue();
      return;
    }

    if (url.searchParams.get("isLocation") === "true") {
      await fulfillJson(route, { items: locations, page: 1, pageSize: locations.length, total: locations.length });
      return;
    }

    const parentIds = url.searchParams.getAll("parentIds");
    if (parentIds.length > 0) {
      const pageNumber = Number(url.searchParams.get("page") || "1");
      const pageSize = Number(url.searchParams.get("pageSize") || "10");
      queries.push({ parentIds, page: pageNumber, pageSize });
      const matched = belongings.filter(item => item.parent && parentIds.includes(item.parent.id));
      const start = (pageNumber - 1) * pageSize;
      await fulfillJson(route, {
        items: matched.slice(start, start + pageSize),
        page: pageNumber,
        pageSize,
        total: matched.length,
      });
      return;
    }

    const itemMatch = path.match(/\/entities\/([0-9a-f-]{36})$/i);
    if (itemMatch) {
      const id = itemMatch[1]!.toLowerCase();
      const known = locations.find(location => location.id === id);
      if (!known) {
        await route.continue();
        return;
      }
      const children =
        id === ANNEX
          ? [
              locationSummary(PAINT, "Paint", ANNEX, 99),
              locationSummary(SPARE, "Spare bins", ANNEX),
              itemRow({ id: BULB, name: "Loose bulb", parentId: ANNEX, quantity: 2, purchasePrice: 8 }),
            ]
          : [];
      await fulfillJson(route, entityOut(id, known.name, children));
      return;
    }

    await route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("empty and no-child rooms use real records, not invented places", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  await page.route(`**/attachments/${PHOTO}**`, route =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG })
  );

  await page.goto(`/location/${LOFT}`);
  const loft = page.getByTestId("purrfect-location");
  await expect(loft).toHaveAttribute("data-state", "empty", { timeout: 30_000 });
  await expect(loft).toHaveAttribute("data-location-id", LOFT);
  await expect(page.getByTestId("location-heading")).toHaveText("North loft");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "0");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-count-kind", "records");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-places", "0");
  await expect(page.getByTestId("place-selectors")).toHaveCount(0);
  await expect(page.getByTestId("location-empty")).toBeVisible();
  await expect(loft).not.toContainText("Utility room");
  await expect(loft).not.toContainText("Pet supplies");
  await expect(loft).not.toContainText("Cleaning");
  await expect(loft).not.toContainText("99");

  await page.goto(`/location/${ATTIC}`);
  const attic = page.getByTestId("purrfect-location");
  await expect(attic).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect(page.getByTestId("place-selectors")).toHaveCount(0);
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "2");
  await expect(page.getByTestId("location-quantity")).toContainText("1.5");
  await expect(page.getByTestId("location-record-count")).toHaveText("2 records");
  const rows = page.getByTestId("location-item-row");
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Attic screw" })).toHaveAttribute(
    "href",
    "/item/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19"
  );
  const screw = rows.filter({ hasText: "Attic screw" });
  await expect(screw.getByTestId("location-item-quantity")).toContainText("0.5");
  await expect(screw.getByTestId("location-item-price")).toContainText("1.25");
  await expect(screw.locator("[data-image-fallback]")).toBeVisible();
  const cloth = rows.filter({ hasText: "Attic cloth" });
  await expect(cloth.getByTestId("location-item-tags")).toContainText("Travel");
  await expect(cloth.locator("[data-image-fallback]")).toHaveCount(0);
  await expect(cloth.locator("img").last()).toHaveAttribute("src", new RegExp(PHOTO));
  await expect(page.getByTestId("location-shelf")).toContainText("Attic cupboard");
  await page.getByTestId("location-more").locator("summary").click();
  await expect(page.getByTestId("location-edit")).toBeVisible();
  await expect(page.getByTestId("location-delete")).toBeVisible();
  await expect(page.getByTestId("location-labels")).toBeVisible();
});

test("direct room entry does not select a child, and a child shows its subtree", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  await page.goto(`/location/${ANNEX}`);

  const view = page.getByTestId("purrfect-location");
  await expect(view).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("whole-room")).toHaveAttribute("data-active", "true");
  await expect(page.locator("[data-testid='place-selector'][data-active='true']")).toHaveCount(0);
  await expect(page.getByTestId("place-selector")).toHaveCount(2);
  await expect(page.getByTestId("place-selector").filter({ hasText: "Loose bulb" })).toHaveCount(0);
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "5");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-quantity", "9.5");
  await expect(page.getByTestId("location-record-count")).toHaveText("5 records");
  await expect(page.getByTestId("location-quantity")).toContainText("9.5");
  await expect(view).not.toContainText("99 records");
  await expect(view).not.toContainText("99 items");

  const paint = page.locator(`[data-place-id='${PAINT}']`);
  await expect(paint.getByTestId("place-count")).toHaveText("3 records");
  await expect(page.locator(`[data-place-id='${SPARE}']`).getByTestId("place-count")).toHaveText("1 record");
  await expect(page.getByTestId("location-item-row")).toHaveCount(5);
  const shelfLabels = await page.getByTestId("location-shelf").allTextContents();
  expect(shelfLabels.map(label => label.trim())).not.toContain("Crate");

  const nails = page.getByTestId("location-item-row").filter({ hasText: "Nails" });
  await expect(nails.getByTestId("location-item-place")).toContainText("High rack");
  await expect(nails.getByTestId("location-item-place")).toContainText("Crate");
  await expect(nails.getByTestId("location-item-quantity")).toContainText("1.5");
  await expect(page.getByRole("link", { name: "Crate" })).toHaveAttribute("href", `/item/${CRATE}`);

  await paint.click();
  await expect(paint).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("whole-room")).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("location-section-title")).toHaveText("Paint");
  await expect(page.getByTestId("location-item-row")).toHaveCount(3);
  await expect(page.getByTestId("location-item-link")).toHaveText(["Crate", "Nails", "Lamp"]);
  await expect(page.getByTestId("location-subset")).toHaveAttribute("data-subset", "3");
  await expect(page.getByTestId("location-subset")).toHaveAttribute("data-room", "5");
  await expect
    .poll(() =>
      queries.some(
        query =>
          query.parentIds.includes(PAINT) &&
          query.parentIds.includes(RACK) &&
          query.parentIds.includes(BIN) &&
          !query.parentIds.includes(SPARE) &&
          !query.parentIds.includes(ANNEX)
      )
    )
    .toBe(true);

  await page.getByTestId("whole-room").click();
  await expect(page.getByTestId("whole-room")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("location-item-row")).toHaveCount(5);
  await expect(view).not.toContainText("Utility room");
  await expect(view).not.toContainText("Pet supplies");
  await expect(view).not.toContainText("Cleaning");
});

test("pagination does not present a page as the room total or a finished shelf group", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  await page.goto(`/location/${PAGE_ROOM}`);

  const view = page.getByTestId("purrfect-location");
  await expect(view).toHaveAttribute("data-state", "partial");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-count-kind", "unknown");
  await expect(page.getByTestId("location-record-count")).not.toHaveText(/^\d+ records$/);
  await expect(page.getByTestId("location-partial")).toBeVisible();
  await expect(page.getByTestId("location-shelf-group")).toHaveCount(0);
  await expect(page.getByTestId("location-inventory")).toHaveAttribute("data-groups", "incomplete");
  await expect.poll(() => queries.length).toBeGreaterThan(0);
  expect(queries[0]?.page).toBe(1);
  expect(queries[0]?.pageSize).toBeGreaterThan(0);
  expect(queries[0]?.pageSize).toBeLessThan(12);

  await page.getByTestId("location-load-more").click();
  await expect(view).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "12");
  await expect(page.getByTestId("location-quantity")).toContainText("12");
  await expect(page.getByTestId("location-item-row")).toHaveCount(12);
  await expect(page.getByTestId("location-inventory")).toHaveAttribute("data-groups", "complete");
  await expect(page.getByTestId("location-shelf")).toContainText("Paged closet");
  await expect(page.getByRole("link", { name: "Paged belonging 12" })).toHaveAttribute(
    "href",
    "/item/bbbbbbbb-bbbb-4bbb-8bbb-000000000012"
  );
});
