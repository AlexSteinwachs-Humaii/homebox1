import { expect, test, type Page, type Route } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

const CARRIER = "77777777-7777-4777-8777-777777777771";
const MINIMAL = "77777777-7777-4777-8777-777777777772";
const SHELF = "77777777-7777-4777-8777-777777777773";
const SUPPLIES = "77777777-7777-4777-8777-777777777774";
const ROOM = "77777777-7777-4777-8777-777777777775";
const TRAVEL = "77777777-7777-4777-8777-777777777776";
const PHOTO = "77777777-7777-4777-8777-777777777777";
const RECEIPT = "77777777-7777-4777-8777-777777777778";
const BOX = "77777777-7777-4777-8777-777777777779";
const TYPE = "77777777-7777-4777-8777-777777777770";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function location(id: string, name: string) {
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
  };
}

function entity(args: {
  id: string;
  name: string;
  description?: string;
  assetId?: string;
  quantity?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  purchaseFrom?: string;
  insured?: boolean;
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  notes?: string;
  imageId?: string | null;
  location?: { id: string; name: string } | null;
  parent?: { id: string; name: string } | null;
  tags?: Array<{ id: string; name: string }>;
  attachments?: unknown[];
  fields?: Array<{ id: string; name: string; textValue: string; type: string }>;
}) {
  return {
    id: args.id,
    name: args.name,
    description: args.description ?? "",
    quantity: args.quantity ?? 1,
    purchasePrice: args.purchasePrice ?? 0,
    purchaseDate: args.purchaseDate ?? "0001-01-01T00:00:00Z",
    purchaseFrom: args.purchaseFrom ?? "",
    archived: false,
    insured: args.insured ?? false,
    assetId: args.assetId ?? "000-000",
    imageId: args.imageId ?? null,
    thumbnailId: args.imageId ?? null,
    tags: args.tags ?? [],
    parent: args.parent ?? null,
    location: args.location ?? null,
    notes: args.notes ?? "",
    createdAt: "2026-01-08T15:00:00Z",
    updatedAt: "2026-03-02T15:00:00Z",
    attachments: args.attachments ?? [],
    children: [],
    fields: args.fields ?? [],
    lifetimeWarranty: false,
    manufacturer: args.manufacturer ?? "",
    modelNumber: args.modelNumber ?? "",
    serialNumber: args.serialNumber ?? "",
    soldDate: "0001-01-01T00:00:00Z",
    soldPrice: 0,
    soldTo: "",
    soldNotes: "",
    warrantyExpires: "0001-01-01T00:00:00Z",
    warrantyDetails: "",
    entityType: { id: TYPE, name: "Item", color: "#888888", isLocation: false },
    totalPrice: args.purchasePrice ?? 0,
    itemCount: 0,
    syncChildEntityLocations: false,
  };
}

const carrier = entity({
  id: CARRIER,
  name: "Cat carrier",
  description: "Soft-sided travel carrier.",
  assetId: "000-071",
  quantity: 1,
  purchasePrice: 68,
  purchaseDate: "2026-01-08",
  purchaseFrom: "Chewy",
  insured: false,
  manufacturer: "Petmate",
  modelNumber: "Vari Kennel 24",
  serialNumber: "PM-24071",
  imageId: PHOTO,
  location: { id: SHELF, name: "Top shelf" },
  parent: { id: SHELF, name: "Top shelf" },
  tags: [{ id: TRAVEL, name: "Travel" }],
  attachments: [
    {
      id: PHOTO,
      type: "photo",
      title: "Carrier photo",
      mimeType: "image/png",
      primary: true,
      path: "",
      thumbnail: { id: PHOTO },
      createdAt: "2026-01-08T15:00:00Z",
      updatedAt: "2026-01-08T15:00:00Z",
    },
    {
      id: RECEIPT,
      type: "receipt",
      title: "Chewy receipt",
      mimeType: "application/pdf",
      primary: false,
      path: "",
      thumbnail: { id: "" },
      createdAt: "2026-01-08T15:00:00Z",
      updatedAt: "2026-01-08T15:00:00Z",
    },
  ],
  fields: [{ id: BOX, name: "Color", textValue: "Lilac", type: "text" }],
});

const minimal = entity({
  id: MINIMAL,
  name: "Loose screw",
  description: "",
  quantity: 3,
  purchasePrice: 0,
  insured: false,
  location: null,
  parent: null,
});

let carrierState = structuredClone(carrier);

function pathFor(id: string) {
  if (id === CARRIER) {
    return [
      { id: ROOM, name: "Utility room", type: "location" },
      { id: SUPPLIES, name: "Pet supplies", type: "location" },
      { id: BOX, name: "Travel box", type: "location" },
      { id: SHELF, name: "Top shelf", type: "location" },
      { id: CARRIER, name: carrierState.name, type: "location" },
    ];
  }
  return [{ id, name: id === MINIMAL ? "Loose screw" : "Other", type: "location" }];
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

function installItemRoutes(page: Page) {
  return page.route(/\/api\/v1\/entities/, async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;

    if (path.endsWith("/tree") || path.endsWith("/export")) {
      await route.continue();
      return;
    }

    if (url.searchParams.get("isLocation") === "true" && method === "GET") {
      await fulfillJson(route, {
        items: [location(ROOM, "Utility room"), location(SUPPLIES, "Pet supplies"), location(SHELF, "Top shelf")],
      });
      return;
    }

    const itemMatch = path.match(/\/entities\/([0-9a-f-]{36})(?:\/(path|maintenance))?$/i);
    if (itemMatch) {
      const id = itemMatch[1]!.toLowerCase();
      const sub = itemMatch[2];
      if (sub === "path" && method === "GET") {
        await fulfillJson(route, pathFor(id));
        return;
      }
      if (sub === "maintenance" && method === "GET") {
        await fulfillJson(route, []);
        return;
      }
      if (method === "GET" && (id === CARRIER || id === MINIMAL)) {
        await fulfillJson(route, id === CARRIER ? carrierState : minimal);
        return;
      }
      if (method === "GET" && (id === ROOM || id === SUPPLIES || id === SHELF)) {
        const name = id === ROOM ? "Utility room" : id === SUPPLIES ? "Pet supplies" : "Top shelf";
        await fulfillJson(route, entity({ id, name }));
        return;
      }
      if (method === "PUT" && id === CARRIER) {
        const body = route.request().postDataJSON() as { name?: string };
        carrierState = { ...carrierState, name: body.name || carrierState.name };
        await fulfillJson(route, carrierState);
        return;
      }
      if (method === "PATCH" && id === CARRIER) {
        const body = route.request().postDataJSON() as { quantity?: number };
        carrierState = { ...carrierState, quantity: body.quantity ?? carrierState.quantity };
        await fulfillJson(route, carrierState);
        return;
      }
      if (method === "POST" && path.endsWith("/duplicate")) {
        await fulfillJson(route, { ...minimal, id: MINIMAL, name: "Copy of Cat carrier" });
        return;
      }
    }

    if (path.endsWith("/entities") && method === "GET" && url.searchParams.getAll("parentIds").length > 0) {
      await fulfillJson(route, { items: [], page: 1, pageSize: 12, total: 0 });
      return;
    }

    await route.continue();
  });
}

test.beforeEach(() => {
  carrierState = structuredClone(carrier);
});

test("purrfect desktop detail shows the real record and keeps actions reachable", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installItemRoutes(page);
  await page.route(`**/attachments/${PHOTO}**`, route =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG })
  );

  await login(page);
  await choosePurrfect(page);
  await page.goto(`/item/${CARRIER}`);

  const detail = page.getByTestId("purrfect-item");
  await expect(detail).toHaveAttribute("data-state", "ready");
  await expect(detail).toHaveAttribute("data-item-id", CARRIER);
  await expect(page.getByTestId("item-name")).toHaveText("Cat carrier");
  await expect(page.getByTestId("item-asset")).toHaveText("Asset 000-071");
  await expect(page.getByText("Travel")).toBeVisible();
  await expect(page.getByTestId("item-description")).toContainText("Soft-sided travel carrier.");
  await expect(page.getByTestId("item-breadcrumb")).toContainText("Utility room");
  await expect(page.getByTestId("item-breadcrumb")).toContainText("Pet supplies");
  await expect(page.getByTestId("item-breadcrumb")).toContainText("Top shelf");
  await expect(page.locator(`[data-crumb-id="${BOX}"]`)).toHaveAttribute("href", `/item/${BOX}`);
  await expect(page.locator(`[data-crumb-id="${ROOM}"]`)).toHaveAttribute("href", `/location/${ROOM}`);
  await expect(page.locator(`[data-crumb-id="${SUPPLIES}"]`)).toHaveAttribute("href", `/location/${SUPPLIES}`);
  await expect(page.locator(`[data-crumb-id="${SHELF}"]`)).toHaveAttribute("href", `/location/${SHELF}`);
  await expect(page.getByTestId("item-location")).toContainText("Utility room");
  await expect(page.getByTestId("item-location")).toContainText("Top shelf");
  await expect(page.getByTestId("item-location")).not.toContainText("Travel box");

  const openLocation = page.getByTestId("open-location");
  const openHref = await openLocation.getAttribute("href");
  expect(openHref).toBeTruthy();
  const openUrl = new URL(openHref ?? "", "http://homebox.local");
  expect(openUrl.pathname).toBe(`/location/${ROOM}`);
  expect(openUrl.searchParams.get("rootLocationId")).toBe(ROOM);
  expect(openUrl.searchParams.get("branchId")).toBe(SUPPLIES);
  expect(openUrl.searchParams.get("destinationId")).toBe(SHELF);
  expect(openUrl.searchParams.get("sourceItemId")).toBe(CARRIER);
  expect(openUrl.searchParams.get("collectionId")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  expect(openHref).not.toMatch(/return|redirect|next=/i);

  const mutations: string[] = [];
  const onRequest = (request: { method: () => string; url: () => string }) => {
    if (request.method() !== "GET" && request.url().includes("/api/")) {
      mutations.push(`${request.method()} ${request.url()}`);
    }
  };
  page.on("request", onRequest);
  await openLocation.click();
  await expect(page).toHaveURL(new RegExp(`/location/${ROOM}\\?`));
  const landed = new URL(page.url());
  expect(landed.searchParams.get("destinationId")).toBe(SHELF);
  expect(landed.searchParams.get("sourceItemId")).toBe(CARRIER);
  expect(landed.searchParams.get("branchId")).toBe(SUPPLIES);
  expect(mutations).toEqual([]);
  page.off("request", onRequest);
  await page.goBack();
  await expect(page.getByTestId("item-name")).toHaveText("Cat carrier");
  await expect(page.getByTestId("item-quantity")).toHaveText("1");
  await expect(page.getByTestId("item-price")).toContainText("68");
  await expect(page.getByTestId("item-insured")).toHaveText("No");
  await expect(page.getByTestId("item-purchased")).toContainText("2026");
  await expect(page.locator("[data-detail='manufacturer']")).toHaveText("Petmate");
  await expect(page.locator("[data-detail='serial']")).toHaveText("PM-24071");
  await expect(page.getByTestId("item-attachments")).toContainText("Chewy receipt");
  await expect(page.getByTestId("item-timestamps")).toContainText("2026");
  await expect(page.getByTestId("item-photo").locator("img").last()).toHaveAttribute("src", new RegExp(PHOTO));
  await expect(page.getByTestId("item-photo").locator("[data-image-fallback]")).toHaveCount(0);

  await page.getByTestId("item-open-photo").click();
  await expect(page.getByRole("img", { name: "attachment image" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("increase-quantity").click();
  await expect(page.getByTestId("item-quantity")).toHaveText("2");

  await page.getByTestId("item-actions").click();
  await expect(page.getByTestId("item-action-duplicate")).toBeVisible();
  await expect(page.getByTestId("item-action-delete")).toBeVisible();
  await expect(page.getByTestId("item-action-template")).toBeVisible();
  await expect(page.getByTestId("item-action-subitem")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("item-maintenance")).toBeVisible();
  await expect(page.getByTestId("item-labels")).toBeVisible();
  await expect(page.getByTestId("item-more")).toContainText("Color");
  await expect(page.getByTestId("item-more")).toContainText("Lilac");

  await page.getByTestId("item-edit").click();
  await expect(page).toHaveURL(new RegExp(`/item/${CARRIER}/edit`));
  const name = page.getByLabel("Name", { exact: true });
  await expect(name).toHaveValue("Cat carrier");
  await name.fill("Cat carrier updated");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/item/${CARRIER}$`));
  await expect(page.getByTestId("item-name")).toHaveText("Cat carrier updated");
});

test("minimal item does not invent carrier values, a photo, or a location", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installItemRoutes(page);
  await login(page);
  await choosePurrfect(page);
  await page.goto(`/item/${MINIMAL}`);

  await expect(page.getByTestId("item-name")).toHaveText("Loose screw");
  await expect(page.getByTestId("item-asset")).toHaveCount(0);
  await expect(page.getByTestId("item-description")).toHaveAttribute("data-empty", "true");
  await expect(page.getByTestId("item-location")).toHaveAttribute("data-empty", "true");
  await expect(page.getByTestId("open-location")).toHaveCount(0);
  await expect(page.getByTestId("item-purchased")).toContainText("Not recorded");
  await expect(page.locator("[data-detail='manufacturer']")).toHaveAttribute("data-empty", "true");
  await expect(page.getByTestId("item-attachments")).toHaveAttribute("data-empty", "true");
  await expect(page.getByTestId("item-photo").locator("[data-image-fallback]")).toBeVisible();
  await expect(page.getByText("Petmate")).toHaveCount(0);
  await expect(page.getByText("Chewy")).toHaveCount(0);
  await expect(page.getByText("Utility room")).toHaveCount(0);
  await expect(page.getByText("000071")).toHaveCount(0);
  await expect(page.getByTestId("item-quantity")).toHaveText("3");
  await expect(page.getByTestId("item-insured")).toHaveText("No");
});

test("a failed or replaced item never keeps the previous record", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  let releaseCarrier = () => {};
  const carrierGate = new Promise<void>(resolve => {
    releaseCarrier = resolve;
  });

  await page.route(/\/api\/v1\/entities/, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const id = path.match(/\/entities\/([0-9a-f-]{36})$/i)?.[1]?.toLowerCase();
    if (route.request().method() === "GET" && id === CARRIER) {
      await carrierGate;
      await fulfillJson(route, carrierState);
      return;
    }
    if (route.request().method() === "GET" && id === MINIMAL) {
      await fulfillJson(route, minimal);
      return;
    }
    if (path.endsWith(`/${MINIMAL}/path`) || path.endsWith(`/${CARRIER}/path`)) {
      await fulfillJson(route, pathFor(id ?? ""));
      return;
    }
    if (url.searchParams.get("isLocation") === "true") {
      await fulfillJson(route, { items: [location(ROOM, "Utility room"), location(SHELF, "Top shelf")] });
      return;
    }
    if (url.searchParams.getAll("parentIds").length > 0) {
      await fulfillJson(route, { items: [] });
      return;
    }
    if (route.request().method() === "GET" && id) {
      await fulfillJson(route, { error: "not found" }, 404);
      return;
    }
    await route.continue();
  });

  await login(page);
  await choosePurrfect(page);
  await page.goto(`/item/${CARRIER}`);
  await expect(page.getByTestId("item-state")).toHaveAttribute("data-state", "loading");
  await expect(page.getByText("Cat carrier")).toHaveCount(0);

  await page.goto(`/item/${MINIMAL}`);
  await expect(page.getByTestId("item-name")).toHaveText("Loose screw");
  releaseCarrier?.();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("item-name")).toHaveText("Loose screw");
  await expect(page.getByText("Petmate")).toHaveCount(0);

  await page.goto("/item/77777777-7777-4777-8777-777777777780");
  await expect(page.getByTestId("item-state")).toHaveAttribute("data-state", "unavailable");
  await expect(page.getByText("Loose screw")).toHaveCount(0);
  await expect(page.getByText("Cat carrier")).toHaveCount(0);
});

test("homebox theme keeps the existing item page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installItemRoutes(page);
  await login(page);
  await page.goto("/profile");
  await page.locator("[data-set-theme='homebox']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "homebox");
  await page.goto(`/item/${CARRIER}`);
  await expect(page.getByTestId("classic-item")).toBeVisible();
  await expect(page.getByTestId("purrfect-item")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cat carrier" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
});
