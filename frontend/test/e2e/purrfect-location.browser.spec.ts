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

function ancestorChain(id: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | null = id;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    const place = locations.find(location => location.id === current);
    const item = belongings.find(row => row.id === current);
    current = place?.parent?.id ?? item?.parent?.id ?? null;
  }
  return chain.reverse();
}

function nearestLocationId(id: string): string | null {
  const chain = ancestorChain(id);
  for (let index = chain.length - 2; index >= 0; index -= 1) {
    const candidate = chain[index];
    if (candidate && locations.some(location => location.id === candidate)) {
      return candidate;
    }
  }
  return null;
}

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

    const pathMatch = path.match(/\/entities\/([0-9a-f-]{36})\/path$/i);
    if (pathMatch) {
      const id = pathMatch[1]!.toLowerCase();
      const chain = ancestorChain(id);
      if (chain.length === 0) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not found" }),
        });
        return;
      }
      await fulfillJson(
        route,
        chain.map(entry => ({ id: entry, name: entry, type: "location" }))
      );
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
      const belonging = belongings.find(item => item.id === id);
      if (belonging) {
        const nearest = nearestLocationId(id);
        await fulfillJson(route, {
          ...entityOut(id, belonging.name),
          ...belonging,
          location: nearest ? locationSummary(nearest, nearest, null) : null,
          entityType: { id: ITEM_TYPE, name: "Item", color: "#888888", isLocation: false },
        });
        return;
      }
      const known = locations.find(location => location.id === id);
      if (!known) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not found" }),
        });
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

const LAMP_SOURCE = LAMP;
const PAGED_LAST = "bbbbbbbb-bbbb-4bbb-8bbb-000000000012";
const DELETED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_COLLECTION = "22222222-2222-4222-8222-222222222222";

function contextHref(root: string, params: Record<string, string>) {
  const query = new URLSearchParams({ rootLocationId: root, ...params });
  return `/location/${root}?${query.toString()}`;
}

test("item context selects the branch, keeps a deeper destination, and marks the real row Opened", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  const mutations: string[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  page.on("request", request => {
    if (request.method() !== "GET" && request.url().includes("/api/")) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  });

  const href = contextHref(ANNEX, {
    branchId: PAINT,
    destinationId: BIN,
    sourceItemId: LAMP_SOURCE,
  });
  await page.goto(href);
  const view = page.getByTestId("purrfect-location");
  await expect(view).toHaveAttribute("data-source-state", "opened", { timeout: 30_000 });
  await expect(view).toHaveAttribute("data-branch-id", PAINT);
  await expect(view).toHaveAttribute("data-destination-id", BIN);
  await expect(view).toHaveAttribute("data-source-item-id", LAMP_SOURCE);
  await expect(page.locator(`[data-place-id='${PAINT}']`)).toHaveAttribute("data-active", "true");
  await expect(page.locator(`[data-place-id='${BIN}']`)).toHaveCount(0);
  await expect(page.getByTestId("whole-room")).toHaveAttribute("data-active", "false");
  const opened = page.locator(`[data-item-id='${LAMP_SOURCE}']`);
  await expect(opened).toHaveAttribute("data-opened", "true");
  await expect(opened.getByTestId("location-item-opened")).toHaveText("Opened");
  await expect(opened).toHaveCount(1);
  expect(mutations).toEqual([]);

  await page.reload();
  await expect(view).toHaveAttribute("data-source-state", "opened", { timeout: 30_000 });
  await expect(view).toHaveAttribute("data-state", "ready");
  await expect(view).toHaveAttribute("data-destination-id", BIN);
  await expect(page.locator(`[data-item-id='${LAMP_SOURCE}']`)).toHaveCount(1);
  expect(mutations).toEqual([]);

  await page.locator(`[data-place-id='${SPARE}']`).click();
  await expect(page.locator(`[data-place-id='${SPARE}']`)).toHaveAttribute("data-active", "true");
  await expect(view).toHaveAttribute("data-source-state", "none");
  await expect(view).toHaveAttribute("data-source-item-id", "");
  await expect(view).toHaveAttribute("data-destination-id", "");
  await expect(page).not.toHaveURL(/sourceItemId|destinationId|branchId/);
  await expect(page.locator(`[data-item-id='${LAMP_SOURCE}']`)).toHaveCount(0);
  expect(mutations).toEqual([]);
});

test("a source on another page is revealed from the real record and not duplicated", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  await page.goto(
    contextHref(PAGE_ROOM, {
      destinationId: PAGE_ROOM,
      sourceItemId: PAGED_LAST,
    })
  );

  const view = page.getByTestId("purrfect-location");
  await expect(view).toHaveAttribute("data-source-state", "opened", { timeout: 30_000 });
  await expect(view).toHaveAttribute("data-state", "partial");
  await expect(view).toHaveAttribute("data-branch-id", "");
  await expect(page.locator(`[data-item-id='${PAGED_LAST}']`)).toHaveCount(1);
  await expect(page.locator(`[data-item-id='${PAGED_LAST}']`)).toHaveAttribute("data-opened", "true");
  await expect(page.getByTestId("location-item-row")).toHaveCount(11);
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "");

  await page.getByTestId("location-load-more").click();
  await expect(view).toHaveAttribute("data-state", "ready");
  await expect(page.locator(`[data-item-id='${PAGED_LAST}']`)).toHaveCount(1);
  await expect(page.getByTestId("location-item-row")).toHaveCount(12);
  await expect(page.getByTestId("location-counts")).toHaveAttribute("data-records", "12");
});

test("malformed, deleted, unrelated and other-collection hints fall back without a fake row", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  const sourceGets: string[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  page.on("request", request => {
    if (request.method() === "GET" && request.url().includes(`/entities/${LAMP_SOURCE}`)) {
      sourceGets.push(request.url());
    }
  });

  await page.goto(`/location/${ANNEX}?sourceItemId=not-a-uuid&branchId=nope&destinationId=1`);
  const view = page.getByTestId("purrfect-location");
  await expect(view).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect(view).toHaveAttribute("data-source-state", "none");
  await expect(page.getByTestId("whole-room")).toHaveAttribute("data-active", "true");
  await expect(page).not.toHaveURL(/sourceItemId|branchId|destinationId/);

  await page.goto(
    contextHref(ANNEX, {
      branchId: PAINT,
      destinationId: BIN,
      sourceItemId: DELETED,
    })
  );
  await expect(view).toHaveAttribute("data-source-state", "none", { timeout: 30_000 });
  await expect(page.locator(`[data-item-id='${DELETED}']`)).toHaveCount(0);
  await expect(page.getByTestId("whole-room")).toHaveAttribute("data-active", "true");
  await expect(page).not.toHaveURL(/sourceItemId/);

  await page.goto(
    contextHref(ANNEX, {
      branchId: LOFT,
      destinationId: BIN,
      sourceItemId: LAMP_SOURCE,
    })
  );
  await expect(view).toHaveAttribute("data-source-state", "none", { timeout: 30_000 });
  await expect(view).toHaveAttribute("data-branch-id", "");
  await expect(page.locator(`[data-item-id='${LAMP_SOURCE}'][data-opened='true']`)).toHaveCount(0);
  await expect(page).not.toHaveURL(/branchId=/);
  expect(queries.some(query => query.parentIds.includes(LOFT) && !query.parentIds.includes(ANNEX))).toBe(false);

  sourceGets.length = 0;
  await page.goto(
    `/location/${ANNEX}?collectionId=${OTHER_COLLECTION}&branchId=${PAINT}&destinationId=${BIN}&sourceItemId=${LAMP_SOURCE}`
  );
  await expect(view).toHaveAttribute("data-source-state", "none", { timeout: 30_000 });
  await expect(page).not.toHaveURL(new RegExp(OTHER_COLLECTION));
  await expect(page).not.toHaveURL(/sourceItemId/);
  await expect(page.locator(`[data-opened='true']`)).toHaveCount(0);
  expect(sourceGets).toEqual([]);
});

test("a late source lookup cannot restore context after the room changes", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  let releaseLookup: (() => void) | null = null;
  const held = new Promise<void>(resolve => {
    releaseLookup = resolve;
  });
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  await page.route(new RegExp(`/entities/${LAMP_SOURCE}$`), async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await held;
    await route.fallback();
  });

  await page.goto(
    contextHref(ANNEX, {
      branchId: PAINT,
      destinationId: BIN,
      sourceItemId: LAMP_SOURCE,
    })
  );
  const view = page.getByTestId("purrfect-location");
  await expect(view).toHaveAttribute("data-source-state", "pending", { timeout: 30_000 });
  await page.goto(`/location/${ATTIC}`);
  releaseLookup?.();
  await expect(view).toHaveAttribute("data-location-id", ATTIC, { timeout: 30_000 });
  await expect(view).toHaveAttribute("data-source-state", "none");
  await expect(page.locator(`[data-item-id='${LAMP_SOURCE}']`)).toHaveCount(0);
  await expect(page.getByTestId("location-item-opened")).toHaveCount(0);
});

async function openAddHere(page: Page) {
  await page.getByTestId("add-item-here").click();
  const form = page.getByTestId("create-entity-form");
  await expect(form).toBeVisible();
  return form;
}

async function closeCreate(page: Page) {
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("create-entity-form")).toHaveCount(0);
}

test("add item here carries the chosen place and does not guess a shelf", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);

  await page.goto(`/location/${LOFT}`);
  const loft = page.getByTestId("purrfect-location");
  await expect(loft).toHaveAttribute("data-state", "empty", { timeout: 30_000 });
  await expect(loft).toHaveAttribute("data-filing-destination", LOFT);
  await expect(loft).toHaveAttribute("data-filing-exact", "false");
  await expect(loft).toHaveAttribute("data-filing-root", LOFT);
  await expect(loft).toHaveAttribute("data-filing-branch", "");
  await expect(page.getByTestId("location-shelf-choice")).toHaveCount(0);
  const loftCollection = await loft.getAttribute("data-filing-collection");
  expect(loftCollection).toBeTruthy();
  expect(loftCollection).not.toBe(OTHER_COLLECTION);

  const loftForm = await openAddHere(page);
  await expect(loftForm).toHaveAttribute("data-contextual", "true");
  await expect(loftForm).toHaveAttribute("data-destination-id", LOFT);
  await expect(loftForm).toHaveAttribute("data-root-id", LOFT);
  await expect(loftForm).toHaveAttribute("data-branch-id", "");
  await expect(loftForm).toHaveAttribute("data-collection-id", loftCollection!);
  await expect(loftForm).toHaveAttribute("data-source-item-id", "");
  await closeCreate(page);
  await expect(page).toHaveURL(new RegExp(`/location/${LOFT}$`));

  await page.goto(`/location/${ANNEX}`);
  const annex = page.getByTestId("purrfect-location");
  await expect(annex).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
  await expect(annex).toHaveAttribute("data-filing-destination", ANNEX);
  await expect(annex).toHaveAttribute("data-filing-exact", "false");
  await page.locator(`[data-place-id='${PAINT}']`).click();
  await expect(annex).toHaveAttribute("data-filing-destination", PAINT);
  await expect(annex).toHaveAttribute("data-filing-exact", "false");
  await expect(annex).toHaveAttribute("data-filing-branch", PAINT);
  await expect(page.locator(`[data-testid='location-shelf-choice'][data-selected='true']`)).toHaveCount(0);

  const branchForm = await openAddHere(page);
  await expect(branchForm).toHaveAttribute("data-destination-id", PAINT);
  await expect(branchForm).toHaveAttribute("data-root-id", ANNEX);
  await expect(branchForm).toHaveAttribute("data-branch-id", PAINT);
  await expect(branchForm).not.toHaveAttribute("data-destination-id", BIN);
  await expect(branchForm).not.toHaveAttribute("data-destination-id", RACK);
  await closeCreate(page);

  await page.locator(`[data-testid='location-shelf-choice'][data-destination-id='${BIN}']`).click();
  await expect(annex).toHaveAttribute("data-filing-destination", BIN);
  await expect(annex).toHaveAttribute("data-filing-exact", "true");
  await expect(annex).toHaveAttribute("data-branch-id", PAINT);
  await expect(page.locator(`[data-testid='location-shelf-choice'][data-destination-id='${BIN}']`)).toHaveAttribute(
    "data-selected",
    "true"
  );
  const shelfForm = await openAddHere(page);
  await expect(shelfForm).toHaveAttribute("data-destination-id", BIN);
  await expect(shelfForm).toHaveAttribute("data-contextual", "true");
  await closeCreate(page);
  await page.locator(`[data-place-id='${SPARE}']`).click();
  await expect(annex).toHaveAttribute("data-filing-destination", SPARE);
  await expect(annex).toHaveAttribute("data-filing-exact", "false");
  await expect(annex).not.toHaveAttribute("data-filing-destination", BIN);

  await page.goto(`/location/${LOFT}`);
  await expect(page.getByTestId("purrfect-location")).toHaveAttribute("data-location-id", LOFT, {
    timeout: 30_000,
  });
  const href = contextHref(ANNEX, {
    branchId: PAINT,
    destinationId: BIN,
    sourceItemId: LAMP_SOURCE,
  });
  await page.goto(href);
  await expect(annex).toHaveAttribute("data-source-state", "opened", { timeout: 30_000 });
  await expect(annex).toHaveAttribute("data-filing-destination", BIN);
  await expect(annex).toHaveAttribute("data-filing-exact", "true");
  await expect(annex).toHaveAttribute("data-filing-branch", PAINT);
  await expect(annex).toHaveAttribute("data-filing-source", LAMP_SOURCE);
  await expect(annex).toHaveAttribute("data-filing-root", ANNEX);
  const handoffForm = await openAddHere(page);
  await expect(handoffForm).toHaveAttribute("data-destination-id", BIN);
  await expect(handoffForm).toHaveAttribute("data-root-id", ANNEX);
  await expect(handoffForm).toHaveAttribute("data-branch-id", PAINT);
  await expect(handoffForm).toHaveAttribute("data-source-item-id", LAMP_SOURCE);
  await expect(handoffForm).toHaveAttribute("data-collection-id", loftCollection!);
  const kept = page.url();
  await closeCreate(page);
  await expect(page).toHaveURL(kept);
  await expect(annex).toHaveAttribute("data-source-state", "opened");
  await expect(annex).toHaveAttribute("data-branch-id", PAINT);
  await expect(annex).toHaveAttribute("data-filing-destination", BIN);
  await expect(page).not.toHaveURL(/return|redirect|next=/i);

  await page.goto(
    `/location/${ANNEX}?collectionId=${OTHER_COLLECTION}&branchId=${PAINT}&destinationId=${BIN}&sourceItemId=${LAMP_SOURCE}`
  );
  await expect(annex).toHaveAttribute("data-source-state", "none", { timeout: 30_000 });
  await expect(annex).toHaveAttribute("data-filing-destination", ANNEX);
  await expect(annex).toHaveAttribute("data-filing-exact", "false");
  await expect(annex).not.toHaveAttribute("data-filing-collection", OTHER_COLLECTION);
  await expect(page).not.toHaveURL(new RegExp(OTHER_COLLECTION));
  const mismatch = await openAddHere(page);
  await expect(mismatch).toHaveAttribute("data-destination-id", ANNEX);
  await expect(mismatch).not.toHaveAttribute("data-destination-id", BIN);
  await expect(mismatch).not.toHaveAttribute("data-collection-id", OTHER_COLLECTION);
  await closeCreate(page);

  await page.getByTestId("purrfect-add-item").click();
  const globalForm = page.getByTestId("create-entity-form");
  await expect(globalForm).toBeVisible();
  await expect(globalForm).toHaveAttribute("data-contextual", "false");
  await expect(globalForm).toHaveAttribute("data-collection-id", "");
  await closeCreate(page);
});

test("contextual create stays on the location and refreshes its list", async ({ page }) => {
  test.setTimeout(120_000);
  const queries: ParentQuery[] = [];
  const creates: Array<{ parentId?: string; name?: string }> = [];
  await login(page);
  await choosePurrfect(page);
  await installRoutes(page, queries);
  await page.route("**/api/v1/entities**", async route => {
    if (route.request().method() !== "POST" || route.request().url().includes("/attachments")) {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as { parentId?: string; name?: string };
    creates.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: body.name ?? "Created" }),
    });
  });

  await page.goto(`/location/${LOFT}`);
  const loft = page.getByTestId("purrfect-location");
  await expect(loft).toHaveAttribute("data-filing-destination", LOFT, { timeout: 30_000 });
  const before = queries.length;
  const form = await openAddHere(page);
  await expect(form).toHaveAttribute("data-destination-id", LOFT);
  await form.locator("input").first().fill("Loose mat");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByTestId("create-entity-form")).toHaveCount(0, { timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/location/${LOFT}`));
  await expect(page).not.toHaveURL(/\/item\//);
  expect(creates).toHaveLength(1);
  expect(creates[0]?.parentId).toBe(LOFT);
  await expect.poll(() => queries.length).toBeGreaterThan(before);
  await expect(loft).toHaveAttribute("data-location-id", LOFT);
  await expect(loft).toHaveAttribute("data-filing-destination", LOFT);
});
