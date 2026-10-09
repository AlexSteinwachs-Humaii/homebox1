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

const UTILITY = "11111111-1111-4111-8111-111111111111";
const TRAVEL_TAG = "22222222-2222-4222-8222-222222222222";
const OTHER_COLLECTION = "33333333-3333-4333-8333-333333333333";

function locationSummary(id: string, name: string) {
  return {
    id,
    name,
    description: "",
    quantity: 1,
    purchasePrice: 0,
    archived: false,
    insured: false,
    assetId: "0",
    imageId: null,
    thumbnailId: null,
    tags: [],
    parent: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

async function installLookupMocks(page: Page) {
  await page.route(/\/api\/v1\/entities\/tree/, route =>
    fulfillJson(
      route,
      JSON.stringify([{ id: UTILITY, name: "Utility room", type: "location", children: [] }])
    )
  );
  await page.route(/\/api\/v1\/tags(?:\?|$)/, route => {
    if (route.request().method() !== "GET") {
      return route.continue();
    }
    return fulfillJson(
      route,
      JSON.stringify([{ id: TRAVEL_TAG, name: "Travel", color: "#cccccc", description: "" }])
    );
  });
  await page.route(/\/api\/v1\/entities\/fields\/values/, route => fulfillJson(route, JSON.stringify(["Orange"])));
  await page.route(/\/api\/v1\/entities\/fields(?:\?|$)/, route => fulfillJson(route, JSON.stringify(["Color"])));
}

test("filters, paging and view keep the query and show the applied values", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const searches: URL[] = [];

  await installLookupMocks(page);
  await page.route(/\/api\/v1\/entities\?/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (url.searchParams.get("isLocation") === "true") {
      await fulfillJson(
        route,
        JSON.stringify({ items: [locationSummary(UTILITY, "Utility room")], page: 1, pageSize: 50, total: 1 })
      );
      return;
    }
    if (url.searchParams.get("q") === null && url.searchParams.get("page") === null) {
      await route.continue();
      return;
    }
    searches.push(url);
    const pageNumber = Number(url.searchParams.get("page") || "1");
    const name = pageNumber === 2 ? "Second page carrier" : "Cat carrier";
    await fulfillJson(route, listBody([item({
      id: CARRIER,
      name,
      description: "Soft sided",
      quantity: 1,
      purchasePrice: 68,
      tags: [{ id: TRAVEL_TAG, name: "Travel" }],
    })], 30));
  });

  await login(page);
  await choosePurrfect(page);
  await setItemView(page, null);
  await page.goto("/items?q=cat");

  const heading = page.getByTestId("search-heading");
  await expect(heading).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("search-results-region")).toHaveAttribute("data-page", "1");
  await expect(page.getByTestId("search-results-region")).toHaveAttribute("data-total", "30");
  await expect(heading).toHaveAttribute("data-count", "30");

  const pageTwo = page.getByRole("button", { name: "2", exact: true }).first();
  await pageTwo.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Second page carrier")).toBeVisible();
  await expect(page.getByTestId("search-results-region")).toHaveAttribute("data-page", "2");
  expect(new URL(page.url()).searchParams.get("q")).toBe("cat");
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");

  await page.getByTestId("search-locations").click();
  await page.getByText("Utility room", { exact: true }).click();
  await expect(page.getByTestId("search-locations")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("search-locations")).toHaveAttribute("aria-pressed", "true");
  const locationChip = page.getByTestId("search-chip").filter({ hasText: "Utility room" });
  await expect(locationChip).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.get("q")).toBe("cat");
  await expect.poll(() => searches.at(-1)?.searchParams.get("page") ?? "1").toBe("1");
  await expect.poll(() => searches.at(-1)?.searchParams.getAll("parentIds")).toEqual([UTILITY]);
  expect(new URL(page.url()).searchParams.get("q")).toBe("cat");
  expect(new URL(page.url()).searchParams.get("page")).toBeNull();

  await locationChip.focus();
  await page.keyboard.press("Enter");
  await expect(locationChip).toHaveCount(0);
  await expect.poll(() => searches.at(-1)?.searchParams.getAll("parentIds") ?? []).toEqual([]);
  await expect.poll(() => searches.at(-1)?.searchParams.get("q")).toBe("cat");

  await page.getByTestId("search-tags").click();
  await page.getByText("Travel", { exact: true }).click();
  await expect(page.getByTestId("search-chip").filter({ hasText: "Travel" })).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.getAll("tags")).toEqual([TRAVEL_TAG]);

  await page.getByTestId("search-options").focus();
  await page.keyboard.press("Enter");
  const archived = page.getByRole("switch", { name: /archived/i });
  await archived.focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("search-options")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("search-chip").filter({ hasText: "Include archived" })).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.get("includeArchived")).toBe("true");

  await page.getByRole("switch", { name: /without photo/i }).click();
  await expect(page.getByTestId("search-chip").filter({ hasText: "Without a photo" })).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.get("onlyWithoutPhoto")).toBe("true");

  await page.getByRole("switch", { name: /negate/i }).click();
  await expect(page.getByTestId("search-chip").filter({ hasText: "Exclude selected tags" })).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.get("negateTags")).toBe("true");

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Created At" }).click();
  await expect(page.getByTestId("search-chip").filter({ hasText: "Order by Created At" })).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.get("orderBy")).toBe("createdAt");
  expect(searches.at(-1)?.searchParams.get("q")).toBe("cat");

  await page.getByRole("switch", { name: /field selector/i }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Select a field", { exact: true }).click();
  await page.getByRole("option", { name: "Color", exact: true }).click();
  await page.getByText("Select a value", { exact: true }).click();
  await page.getByRole("option", { name: "Orange", exact: true }).click();
  await expect(page.getByTestId("search-chip").filter({ hasText: "Color is Orange" })).toBeVisible();
  await expect.poll(() => searches.at(-1)?.searchParams.getAll("fields")).toContain("Color=Orange");
  expect(searches.at(-1)?.searchParams.get("q")).toBe("cat");
  expect(searches.at(-1)?.searchParams.getAll("parentIds")).toEqual([]);

  const filteredUrl = page.url();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Table", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(filteredUrl);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" }).first()).toBeVisible();
  await page.getByRole("button", { name: "First" }).first().focus();
  await expect(page.getByRole("button", { name: "First" }).first()).toBeFocused();
});

test("no-match, failure, refresh and a late collection response stay distinct", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.addInitScript(() => {
    const original = Location.prototype.reload;
    Location.prototype.reload = function (this: Location, ...args: []) {
      if (sessionStorage.getItem("hb-suppress-reload") === "1") {
        window.dispatchEvent(new Event("hb-reload-suppressed"));
        return;
      }
      return original.apply(this, args);
    };
  });

  let mode: "hold" | "empty" | "error" | "ok" | "page" = "ok";
  const held: Route[] = [];
  const tenants: string[] = [];

  await installLookupMocks(page);
  await page.route(/\/api\/v1\/groups\/all$/, async route => {
    const response = await route.fetch();
    const groups = (await response.json()) as Array<{ id: string; name: string }>;
    const current = groups[0];
    await fulfillJson(
      route,
      JSON.stringify([
        ...(current ? [current] : []),
        {
          id: OTHER_COLLECTION,
          name: "Other home",
          currency: "USD",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ])
    );
  });
  await page.route(/\/api\/v1\/entities\?/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const tenant = route.request().headers()["x-tenant"] ?? "";
    if (url.searchParams.get("isLocation") === "true") {
      const id = tenant === OTHER_COLLECTION ? "44444444-4444-4444-8444-444444444444" : UTILITY;
      const name = tenant === OTHER_COLLECTION ? "Other room" : "Utility room";
      await fulfillJson(route, JSON.stringify({ items: [locationSummary(id, name)], page: 1, pageSize: 50, total: 1 }));
      return;
    }
    if (!url.searchParams.get("q") && !url.searchParams.get("page")) {
      await route.continue();
      return;
    }
    tenants.push(tenant);
    if (mode === "hold") {
      held.push(route);
      return;
    }
    if (mode === "empty") {
      await fulfillJson(route, listBody([], 0));
      return;
    }
    if (mode === "error") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "nope" }) });
      return;
    }
    const stale = tenant !== OTHER_COLLECTION && url.searchParams.get("q") === "late";
    await fulfillJson(
      route,
      listBody([
        item({
          id: stale ? CARRIER : BOWL,
          name: stale ? "Stale carrier" : tenant === OTHER_COLLECTION ? "Other bowl" : "Cat carrier",
          description: "held",
          quantity: 1,
          purchasePrice: 12,
        }),
      ])
    );
  });

  await login(page);
  await choosePurrfect(page);
  await setItemView(page, null);

  mode = "empty";
  await page.goto("/items?q=missing");
  await expect(page.getByTestId("search-status")).toHaveAttribute("data-phase", "empty");
  await expect(page.getByTestId("search-heading")).toHaveAttribute("data-state", "empty");
  await expect(page.getByTestId("search-heading")).toContainText("No belongings match missing");
  await expect(page.getByText("No Items Found")).toHaveCount(0);
  await expect(page.getByTestId("search-reset")).toBeVisible();
  await page.getByTestId("search-reset").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.url()).toContain("/items");
  await expect(page.getByTestId("search-heading")).not.toHaveAttribute("data-state", "error");

  mode = "error";
  await page.goto("/items?q=broken");
  await expect(page.getByTestId("search-status")).toHaveAttribute("data-phase", "error");
  await expect(page.getByTestId("search-heading")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("search-heading")).not.toContainText("0 belongings");
  await expect(page.getByText("No Items Found")).toHaveCount(0);
  mode = "ok";
  await page.getByTestId("search-retry").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("search-heading")).toHaveAttribute("data-state", "ready");
  await expect(page.getByText("Cat carrier")).toBeVisible();

  mode = "hold";
  await page.goto("/items?q=late");
  await expect(page.getByTestId("search-status")).toHaveAttribute("data-phase", "initial");
  await expect.poll(() => held.length).toBeGreaterThan(0);
  mode = "ok";
  await page.evaluate(() => sessionStorage.setItem("hb-suppress-reload", "1"));
  await page.getByRole("combobox", { name: "Select Collection" }).click();
  await page.getByRole("option", { name: "Other home" }).click();
  const stale = held.shift();
  if (stale) {
    await fulfillJson(
      stale,
      listBody([item({ id: CARRIER, name: "Stale carrier", description: "old", quantity: 1, purchasePrice: 1 })])
    );
  }
  await expect(page.getByText("Stale carrier")).toHaveCount(0);
  mode = "ok";
  await expect(page.getByText("Other bowl")).toBeVisible();
  await expect(page.getByTestId("search-results-region")).toHaveAttribute("data-results-collection", OTHER_COLLECTION);
  expect(tenants.at(-1)).toBe(OTHER_COLLECTION);
  await expect(page.getByTestId("search-chip").filter({ hasText: "Utility room" })).toHaveCount(0);
});
