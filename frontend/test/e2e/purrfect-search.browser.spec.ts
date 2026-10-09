import { expect, test, type Page, type Route } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

const CARRIER = "77777777-7777-4777-8777-777777777771";
const BOWL = "77777777-7777-4777-8777-777777777772";
const SHELF = "77777777-7777-4777-8777-777777777773";
const SUPPLIES = "77777777-7777-4777-8777-777777777774";
const ROOM = "77777777-7777-4777-8777-777777777775";
const TRAVEL = "77777777-7777-4777-8777-777777777776";
const PHOTO = "77777777-7777-4777-8777-777777777777";
const API_TOTAL = 17;

const PREFERENCE_KEY = "homebox/preferences/location";

function item(args: {
  id: string;
  name: string;
  description: string;
  notes?: string;
  quantity: number;
  purchasePrice: number;
  imageId?: string | null;
  tags?: Array<{ id: string; name: string }>;
  parent?: { id: string; name: string; parent?: { id: string; name: string; parent?: { id: string; name: string } } };
}) {
  return {
    id: args.id,
    name: args.name,
    description: args.description,
    quantity: args.quantity,
    purchasePrice: args.purchasePrice,
    archived: false,
    insured: false,
    assetId: "0",
    imageId: args.imageId ?? null,
    thumbnailId: args.imageId ?? null,
    tags: args.tags ?? [],
    parent: args.parent ?? null,
    notes: args.notes ?? "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const NAME_MATCH = item({
  id: CARRIER,
  name: "Cat carrier",
  description: "Soft sided",
  quantity: 1,
  purchasePrice: 68,
  imageId: PHOTO,
  tags: [{ id: TRAVEL, name: "Travel" }],
  parent: {
    id: SHELF,
    name: "Top shelf",
    parent: { id: SUPPLIES, name: "Pet supplies", parent: { id: ROOM, name: "Utility room" } },
  },
});

const OTHER_FIELD_MATCH = item({
  id: BOWL,
  name: "Ceramic bowl",
  description: "Not a name hit",
  notes: "Stored with the cat bowls",
  quantity: 2,
  purchasePrice: 12,
  imageId: null,
});

function listBody(items: unknown[], total = API_TOTAL) {
  return JSON.stringify({
    items,
    page: 1,
    pageSize: 12,
    total,
    totalPrice: 80,
  });
}

async function fulfillJson(route: Route, body: string) {
  await route.fulfill({ status: 200, contentType: "application/json", body });
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

async function setItemView(page: Page, view: "card" | "table" | null) {
  await page.evaluate(
    ({ key, next }) => {
      const current = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, unknown>;
      if (next === null) {
        delete current.itemDisplayView;
      } else {
        current.itemDisplayView = next;
      }
      localStorage.setItem(key, JSON.stringify(current));
    },
    { key: PREFERENCE_KEY, next: view }
  );
}

test("shell search opens collection-scoped visual results with the API total", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const searchRequests: URL[] = [];
  const tenants: string[] = [];

  await page.route(/\/api\/v1\/entities\?/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (!url.searchParams.get("q")) {
      await route.continue();
      return;
    }
    searchRequests.push(url);
    tenants.push(route.request().headers()["x-tenant"] ?? "");
    await fulfillJson(route, listBody([NAME_MATCH, OTHER_FIELD_MATCH]));
  });

  await page.route(new RegExp(`/api/v1/entities/${CARRIER}$`), async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await fulfillJson(
      route,
      JSON.stringify({
        ...NAME_MATCH,
        attachments: [],
        children: [],
        fields: [],
        lifetimeWarranty: false,
        manufacturer: "",
        modelNumber: "",
        purchaseFrom: "",
        purchaseTime: "2026-01-01T00:00:00Z",
        serialNumber: "",
        soldTime: "0001-01-01T00:00:00Z",
        warrantyExpires: "0001-01-01T00:00:00Z",
        warrantyDetails: "",
      })
    );
  });

  await page.route(`**/attachments/${PHOTO}**`, route =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      ),
    })
  );

  await login(page);
  await choosePurrfect(page);
  await setItemView(page, null);

  await page.goto("/home");
  const search = page.getByTestId("purrfect-search");
  await search.fill("cat");
  await search.press("Enter");

  await expect(page).toHaveURL(/\/items\?q=cat(?:&|$)/);
  const landed = new URL(page.url());
  expect(landed.pathname).toBe("/items");
  expect(landed.searchParams.get("q")).toBe("cat");
  expect(landed.searchParams.get("collectionId")).toBeNull();
  expect(landed.searchParams.get("loc")).toBeNull();
  expect(landed.searchParams.get("tag")).toBeNull();

  const heading = page.getByTestId("search-heading");
  await expect(heading).toHaveAttribute("data-state", "ready");
  await expect(heading).toHaveAttribute("data-mode", "match");
  await expect(heading).toHaveAttribute("data-count", String(API_TOTAL));
  await expect(heading).toContainText("17 belongings match cat");
  await expect(heading).not.toContainText("2 belongings");

  const behavior = page.getByTestId("search-behavior");
  await expect(behavior).toContainText("description");
  await expect(behavior).toContainText("serial number");
  await expect(behavior).toContainText("model number");
  await expect(behavior).toContainText("manufacturer");
  await expect(behavior).toContainText("notes");
  await expect(behavior).not.toContainText(/name matches only/i);
  await expect(behavior).not.toContainText(/name contains/i);
  await expect(behavior).not.toContainText(/filtered by pet/i);

  await expect(page.getByTestId("search-locations")).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("search-tags")).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("search-locations")).toContainText("Locations");
  await expect(page.getByTestId("search-tags")).toContainText("Tags");
  await expect(page.getByTestId("search-options")).toHaveAttribute("data-active", "false");
  await expect(page.getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-pressed", "true");

  const cards = page.locator("[data-inventory-card='item']");
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("search-showing")).toHaveText("Showing 2 of 17");

  const carrier = cards.filter({ hasText: "Cat carrier" });
  await expect(carrier.getByTestId("item-link")).toHaveAttribute("href", `/item/${CARRIER}`);
  await expect(carrier.getByTestId("location-path")).toContainText("Utility room");
  await expect(carrier.getByTestId("location-path")).toContainText("Pet supplies");
  await expect(carrier.getByTestId("location-path")).toContainText("Top shelf");
  await expect(carrier.getByText("Travel")).toBeVisible();
  await expect(carrier.getByTestId("item-quantity")).toContainText("1");
  await expect(carrier.getByTestId("item-price")).toContainText("68");
  await expect(carrier.locator("[data-inventory-image] img").last()).toHaveAttribute("src", new RegExp(PHOTO));
  await expect(carrier.getByTestId("view-item")).toBeVisible();

  const bowl = cards.filter({ hasText: "Ceramic bowl" });
  await expect(bowl).toBeVisible();
  await expect(bowl.locator("[data-image-fallback]")).toBeVisible();
  await expect(bowl.getByTestId("item-quantity")).toContainText("2");
  await expect(page.getByText("Toy basket")).toHaveCount(0);

  expect(searchRequests.length).toBeGreaterThan(0);
  const requested = searchRequests.at(-1)!;
  expect(requested.searchParams.get("q")).toBe("cat");
  expect(requested.searchParams.getAll("parentIds")).toEqual([]);
  expect(requested.searchParams.getAll("tags")).toEqual([]);
  expect(requested.searchParams.get("fields")).toBeNull();
  expect(requested.pathname).toBe("/api/v1/entities");

  const collectionId = await page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return "";
    }
    const parsed = JSON.parse(raw) as { collectionId?: string };
    return parsed.collectionId ?? "";
  }, PREFERENCE_KEY);
  if (collectionId) {
    expect(tenants.at(-1)).toBe(collectionId);
  }

  const beforeToggle = page.url();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page).toHaveURL(beforeToggle);
  await expect(page.locator("[data-item-view='table']")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page).toHaveURL(beforeToggle);
  await carrier.getByTestId("view-item").click();
  await expect(page).toHaveURL(new RegExp(`/item/${CARRIER}$`));
  await expect(page.getByRole("heading", { name: "Cat carrier" })).toBeVisible();
});

test("an explicit table preference is kept and a missing preference opens cards", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.route(/\/api\/v1\/entities\?/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (url.searchParams.get("q") !== "nest") {
      await route.continue();
      return;
    }
    await fulfillJson(route, listBody([NAME_MATCH], 4));
  });

  await login(page);
  await choosePurrfect(page);
  await setItemView(page, "table");
  await page.goto("/items?q=nest&page=2");

  await expect(page.getByTestId("search-heading")).toHaveAttribute("data-state", "ready");
  await expect(page.getByRole("button", { name: "Table", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-inventory-card='item']")).toHaveCount(0);
  await expect(page.getByRole("table")).toBeVisible();

  const tableUrl = page.url();
  expect(new URL(tableUrl).searchParams.get("q")).toBe("nest");
  expect(new URL(tableUrl).searchParams.get("page")).toBe("2");

  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page).toHaveURL(tableUrl);
  await expect(page.locator("[data-inventory-card='item']")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  expect(new URL(page.url()).searchParams.get("loc")).toBeNull();
  expect(new URL(page.url()).searchParams.get("tag")).toBeNull();

  await setItemView(page, null);
  await page.reload();
  await expect(page.getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-inventory-card='item']")).toHaveCount(1);
});

test("classic theme keeps the existing search page", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page);
  await choosePurrfect(page);
  await page.goto("/profile");
  await page.locator("[data-set-theme='homebox']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "homebox");

  await page.goto("/items?q=cat");
  await expect(page.getByTestId("purrfect-search-results")).toHaveCount(0);
  await expect(page.getByTestId("items-search")).toBeVisible();
  await expect(page.getByTestId("items-search")).toHaveValue("cat");
  await expect(page.getByRole("button", { name: "Card", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cards", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("view-item")).toHaveCount(0);
});
