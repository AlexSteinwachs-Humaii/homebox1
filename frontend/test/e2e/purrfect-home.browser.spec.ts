import { expect, test, type Page, type Route } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

const KITCHEN = "11111111-1111-4111-8111-111111111111";
const GARAGE = "22222222-2222-4222-8222-222222222222";
const NESTED = "33333333-3333-4333-8333-333333333333";
const ZEBRA = "44444444-4444-4444-8444-444444444444";
const APPLE = "55555555-5555-4555-8555-555555555555";
const MANGO = "66666666-6666-4666-8666-666666666666";
const CARRIER = "77777777-7777-4777-8777-777777777777";
const MIXER = "88888888-8888-4888-8888-888888888888";
const TRAVEL = "99999999-9999-4999-8999-999999999999";
const PHOTO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const RECENT = [
  item(ZEBRA, "Zebra lamp", GARAGE, "Garage", 2, 19.5, []),
  item(APPLE, "Apple crate", KITCHEN, "Kitchen", 1, 12, [{ id: TRAVEL, name: "Travel" }]),
  item(MANGO, "Mango bowl", KITCHEN, "Kitchen", 4, 8, []),
  item(CARRIER, "Cat carrier", GARAGE, "Garage", 1, 68, [{ id: TRAVEL, name: "Travel" }]),
  item(MIXER, "Stand mixer", KITCHEN, "Kitchen", 1, 240, []),
];

const ROOTS = [location(KITCHEN, "Kitchen", 3), location(GARAGE, "Garage", 0)];

function item(
  id: string,
  name: string,
  parentId: string,
  parentName: string,
  quantity: number,
  purchasePrice: number,
  tags: Array<{ id: string; name: string }>
) {
  return {
    id,
    name,
    description: "",
    quantity,
    purchasePrice,
    archived: false,
    insured: false,
    assetId: "0",
    imageId: id === APPLE ? PHOTO : null,
    thumbnailId: id === APPLE ? PHOTO : null,
    tags,
    parent: { id: parentId, name: parentName },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function location(id: string, name: string, itemCount: number) {
  return {
    id,
    name,
    description: "",
    quantity: 1,
    purchasePrice: 0,
    archived: false,
    insured: false,
    assetId: "0",
    itemCount,
    tags: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function entityOut(summary: ReturnType<typeof item> | ReturnType<typeof location>) {
  return {
    ...summary,
    attachments: [],
    children: [],
    fields: [],
    lifetimeWarranty: false,
    manufacturer: "",
    modelNumber: "",
    notes: "",
    purchaseFrom: "",
    purchaseTime: "2026-01-01T00:00:00Z",
    serialNumber: "",
    soldTime: "0001-01-01T00:00:00Z",
    warrantyExpires: "0001-01-01T00:00:00Z",
    warrantyDetails: "",
  };
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

function listBody(items: unknown[]) {
  return JSON.stringify({
    items,
    page: 1,
    pageSize: items.length,
    total: items.length,
    totalPrice: 0,
  });
}

async function fulfillJson(route: Route, body: string) {
  await route.fulfill({ status: 200, contentType: "application/json", body });
}

test("Purrfect Home overview uses real records in response order", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1040 });

  const itemQueries: URL[] = [];
  const locationQueries: URL[] = [];

  await page.route(/\/api\/v1\/entities(\/|$|\?)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const id = url.pathname.match(/\/entities\/([0-9a-f-]{36})$/i)?.[1];
    if (id) {
      const found = [...RECENT, ...ROOTS, location(NESTED, "Nested shelf", 1)].find(entry => entry.id === id);
      if (!found) {
        await route.continue();
        return;
      }
      await fulfillJson(route, JSON.stringify(entityOut(found)));
      return;
    }
    if (url.pathname.endsWith("/entities/tree") || url.pathname.includes("/attachments")) {
      await route.continue();
      return;
    }
    if (url.searchParams.get("isLocation") === "true" && url.searchParams.get("filterChildren") === "true") {
      locationQueries.push(url);
      await fulfillJson(route, listBody(ROOTS));
      return;
    }
    if (url.searchParams.get("orderBy") === "createdAt") {
      itemQueries.push(url);
      await fulfillJson(route, listBody(RECENT));
      return;
    }
    await route.continue();
  });

  await page.route("**/groups/statistics", async route => {
    if (route.request().method() !== "GET" || route.request().url().includes("/statistics/")) {
      await route.continue();
      return;
    }
    await fulfillJson(
      route,
      JSON.stringify({
        totalItemPrice: 321.5,
        totalItems: 17,
        totalLocations: 6,
        totalTags: 9,
        totalUsers: 1,
        totalWithWarranty: 0,
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
  await page.goto("/home");

  const overview = page.locator("[data-overview='purrfect']");
  await expect(overview).toBeVisible();
  await expect(page.locator("[data-overview='classic']")).toHaveCount(0);
  await expect(page.getByTestId("purrfect-hero")).toBeVisible();
  await expect(page.getByTestId("hero-cat").locator("[data-decorative-cat]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /A happy home/ })).toBeVisible();
  await expect(overview.getByRole("heading", { name: "Explore your spaces" })).toBeVisible();
  await expect(overview.getByRole("heading", { name: "A few belongings" })).toBeVisible();
  await expect(overview.getByRole("heading", { name: "Recently added" })).toBeVisible();
  await expect(overview).not.toContainText(/cat essentials/i);
  await expect(overview).not.toContainText(/cat-household/i);
  await expect(overview).not.toContainText("$8,420");
  await expect(overview).not.toContainText("8420");

  await expect.poll(() => locationQueries.length).toBeGreaterThan(0);
  const locationQuery = locationQueries[0]!;
  expect(locationQuery.searchParams.get("filterChildren")).toBe("true");
  expect(locationQuery.searchParams.get("isLocation")).toBe("true");

  await expect.poll(() => itemQueries.length).toBeGreaterThan(0);
  const itemQuery = itemQueries[0]!;
  expect(itemQuery.searchParams.get("orderBy")).toBe("createdAt");
  expect(itemQuery.searchParams.get("page")).toBe("1");
  expect(itemQuery.searchParams.get("pageSize")).toBe("5");
  expect(itemQuery.searchParams.get("q")).toBeNull();
  expect(itemQuery.searchParams.get("tags")).toBeNull();

  const spaces = page.getByTestId("explore-spaces");
  const locationCards = spaces.locator("[data-inventory-card='location']");
  await expect(locationCards).toHaveCount(2);
  await expect(spaces).not.toContainText("Nested shelf");
  await expect(locationCards.nth(0).getByTestId("location-link")).toHaveAttribute("href", `/location/${KITCHEN}`);
  await expect(locationCards.nth(0).getByTestId("location-count")).toHaveText("3 items");
  await expect(locationCards.nth(1).getByTestId("location-count")).toHaveText("0 items");
  await expect(page.getByTestId("browse-locations")).toHaveAttribute("href", "/locations");
  await expect(page.getByTestId("browse-locations")).toContainText("All 6 locations");

  const featured = page.getByTestId("featured-belongings");
  const featuredCards = featured.locator("[data-inventory-card='item']");
  await expect(featuredCards).toHaveCount(3);
  await expect(featuredCards.nth(0).getByTestId("item-link")).toHaveText("Zebra lamp");
  await expect(featuredCards.nth(1).getByTestId("item-link")).toHaveText("Apple crate");
  await expect(featuredCards.nth(2).getByTestId("item-link")).toHaveText("Mango bowl");
  await expect(featured).not.toContainText("Cat carrier");
  await expect(featuredCards.nth(0).getByTestId("item-link")).toHaveAttribute("href", `/item/${ZEBRA}`);
  await expect(featuredCards.nth(0).getByTestId("location-path")).toContainText("Garage");
  await expect(featuredCards.nth(0).getByTestId("item-quantity")).toHaveText("Qty 2");
  await expect(featuredCards.nth(1).getByRole("link", { name: "Travel" })).toBeVisible();
  await expect(featuredCards.locator("[data-decorative-cat]")).toHaveCount(0);
  await expect(featuredCards.nth(1).locator("[data-inventory-image] img").last()).toHaveAttribute(
    "src",
    new RegExp(`/entities/${APPLE}/attachments/${PHOTO}`)
  );
  await expect(featuredCards.nth(0).locator("[data-image-fallback]")).toBeVisible();
  await expect(page.getByTestId("browse-items")).toHaveAttribute("href", "/items");

  const recent = page.getByTestId("recent-item");
  await expect(recent).toHaveCount(5);
  await expect(recent.nth(0)).toContainText("Zebra lamp");
  await expect(recent.nth(0)).toContainText("Garage");
  await expect(recent.nth(3)).toContainText("Cat carrier");
  await expect(recent.nth(3)).toHaveAttribute("href", `/item/${CARRIER}`);
  await expect(recent.nth(4)).toContainText("Stand mixer");

  const stats = page.getByTestId("purrfect-stats");
  await expect(stats.locator("[data-stat='items']")).toContainText("17");
  await expect(stats.locator("[data-stat='locations']")).toContainText("6");
  await expect(stats.locator("[data-stat='tags']")).toContainText("9");
  await expect(stats.locator("[data-stat='value']")).toContainText("321");
  await expect(stats.getByTestId("purrfect-theme-label")).toHaveText("Purrfect Home · Optional theme");

  await page.getByTestId("browse-items").click();
  await expect(page).toHaveURL("/items");
  await page.goto("/home");
  await page.getByTestId("browse-locations").click();
  await expect(page).toHaveURL("/locations");

  await page.goto("/home");
  await featuredCards.nth(0).getByTestId("item-link").click();
  await expect(page).toHaveURL(new RegExp(`/item/${ZEBRA}$`));
  await expect(page.locator("h1").filter({ hasText: "Zebra lamp" }).first()).toBeVisible();

  await page.goto("/home");
  await recent.nth(3).click();
  await expect(page).toHaveURL(new RegExp(`/item/${CARRIER}$`));
  await expect(page.locator("h1").filter({ hasText: "Cat carrier" }).first()).toBeVisible();

  await page.goto("/home");
  await locationCards.nth(0).getByTestId("location-link").click();
  await expect(page).toHaveURL(new RegExp(`/location/${KITCHEN}$`));

  await page.goto("/home");
  const search = page.locator("[data-shell='purrfect']").getByRole("searchbox");
  await search.fill("stand mixer");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/items\?q=/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("stand mixer");
});

test("an empty collection does not invent overview records", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.route(/\/api\/v1\/entities(\?|$)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (url.searchParams.get("isLocation") === "true" || url.searchParams.get("orderBy") === "createdAt") {
      await fulfillJson(route, listBody([]));
      return;
    }
    await route.continue();
  });
  await page.route("**/groups/statistics", async route => {
    if (route.request().method() !== "GET" || route.request().url().includes("/statistics/")) {
      await route.continue();
      return;
    }
    await fulfillJson(
      route,
      JSON.stringify({
        totalItemPrice: 0,
        totalItems: 0,
        totalLocations: 0,
        totalTags: 0,
        totalUsers: 1,
        totalWithWarranty: 0,
      })
    );
  });

  await login(page);
  await choosePurrfect(page);
  await page.goto("/home");

  const overview = page.locator("[data-overview='purrfect']");
  await expect(overview).toBeVisible();
  await expect(overview.getByTestId("purrfect-stats")).toHaveAttribute("data-state", "ready");
  await expect(overview.getByTestId("items-state")).toHaveAttribute("data-state", "empty");
  await expect(overview.getByTestId("locations-state")).toHaveAttribute("data-state", "empty");
  await expect(overview.locator("[data-inventory-card='item']")).toHaveCount(0);
  await expect(overview.locator("[data-inventory-card='location']")).toHaveCount(0);
  await expect(overview.getByTestId("recent-item")).toHaveCount(0);
  await expect(overview.locator("[data-stat='items'] dd")).toHaveText("0");
  await expect(overview.locator("[data-stat='locations'] dd")).toHaveText("0");
  await expect(overview.locator("[data-stat='tags'] dd")).toHaveText("0");
  await expect(overview.locator("[data-stat='value']")).toContainText("0");
  await expect(overview).not.toContainText("Cat carrier");
  await expect(overview).not.toContainText("Kitchen");
  await expect(overview).not.toContainText("$8,420");
  await expect(overview).not.toContainText("8420");
  await expect(overview.getByTestId("browse-locations")).toHaveAttribute("href", "/locations");
  await expect(overview.getByTestId("browse-locations")).toContainText("All locations");
  await expect(overview.getByTestId("browse-items")).toHaveAttribute("href", "/items");
  await expect(overview.getByRole("heading", { name: "A few belongings" })).toBeVisible();
  await expect(page.getByTestId("purrfect-search")).toBeVisible();
  await expect(page.getByTestId("purrfect-scan")).toBeEnabled();
  await expect(page.getByTestId("purrfect-add-item")).toBeEnabled();
});

test("other themes keep the existing home overview", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await expect(page.locator("[data-overview='classic']")).toBeVisible();
  await expect(page.getByText("Quick Statistics")).toBeVisible();
  await expect(page.getByText("Storage Locations")).toBeVisible();
  await expect(page.locator("[data-overview='purrfect']")).toHaveCount(0);
  await expect(page.getByTestId("purrfect-hero")).toHaveCount(0);

  await choosePurrfect(page);
  await page.goto("/home");
  await expect(page.locator("[data-overview='purrfect']")).toBeVisible();

  await page.goto("/profile");
  await page.locator("[data-set-theme='homebox']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "homebox");
  await page.goto("/home");
  await expect(page.locator("[data-overview='classic']")).toBeVisible();
  await expect(page.getByText("Quick Statistics")).toBeVisible();
  await expect(page.locator("[data-overview='purrfect']")).toHaveCount(0);
});

function statisticsBody(totalItems: number, totalLocations = 6, totalTags = 9, totalItemPrice = 321.5) {
  return JSON.stringify({
    totalItemPrice,
    totalItems,
    totalLocations,
    totalTags,
    totalUsers: 1,
    totalWithWarranty: 0,
  });
}

test("failed statistics are not shown as zeros and can be retried", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let allowStatistics = false;

  await page.route("**/groups/statistics", async route => {
    if (route.request().method() !== "GET" || route.request().url().includes("/statistics/")) {
      await route.continue();
      return;
    }
    if (!allowStatistics) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "statistics unavailable" }),
      });
      return;
    }
    await fulfillJson(route, statisticsBody(17));
  });

  await login(page);
  await choosePurrfect(page);
  await page.goto("/home");

  const overview = page.locator("[data-overview='purrfect']");
  const stats = overview.getByTestId("purrfect-stats");
  await expect(stats).toHaveAttribute("data-state", "error");
  await expect(stats.getByTestId("stats-state")).toHaveAttribute("data-state", "error");
  await expect(stats.locator("[data-stat]")).toHaveCount(0);
  await expect(stats).not.toContainText("128");
  await expect(stats).not.toContainText("$8,420");
  await expect(stats).not.toContainText("8420");
  await expect(overview.getByTestId("browse-items")).toBeEnabled();
  await expect(overview.getByTestId("browse-locations")).toHaveAttribute("href", "/locations");
  await expect(page.getByTestId("purrfect-search")).toBeVisible();
  await expect(page.getByTestId("purrfect-scan")).toBeEnabled();
  await expect(page.getByTestId("purrfect-add-item")).toBeEnabled();

  allowStatistics = true;
  await stats.getByTestId("stats-retry").click();
  await expect(stats).toHaveAttribute("data-state", "ready");
  await expect(stats.locator("[data-stat='items'] dd")).toHaveText("17");
  await expect(stats.locator("[data-stat='locations'] dd")).toHaveText("6");
  await expect(stats.locator("[data-stat='value']")).toContainText("321");
});

test("a failed recent-item list can be retried without hiding entry points", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let allowItems = false;

  await page.route(/\/api\/v1\/entities(\?|$)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (url.searchParams.get("orderBy") !== "createdAt") {
      await route.continue();
      return;
    }
    if (!allowItems) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "items unavailable" }),
      });
      return;
    }
    await fulfillJson(route, listBody(RECENT));
  });
  await page.route("**/groups/statistics", async route => {
    if (route.request().method() !== "GET" || route.request().url().includes("/statistics/")) {
      await route.continue();
      return;
    }
    await fulfillJson(route, statisticsBody(17));
  });

  await login(page);
  await choosePurrfect(page);
  await page.goto("/home");

  const overview = page.locator("[data-overview='purrfect']");
  await expect(overview.getByTestId("items-state")).toHaveAttribute("data-state", "error");
  await expect(overview.locator("[data-inventory-card='item']")).toHaveCount(0);
  await expect(overview.getByTestId("recent-item")).toHaveCount(0);
  await expect(overview).not.toContainText("Zebra lamp");
  await expect(overview.getByTestId("browse-items")).toHaveAttribute("href", "/items");
  await expect(overview.getByTestId("browse-locations")).toBeVisible();
  await expect(page.getByTestId("purrfect-add-item")).toBeEnabled();

  allowItems = true;
  await overview.getByTestId("items-retry").click();
  await expect(overview.getByTestId("items-state")).toHaveAttribute("data-state", "ready");
  await expect(overview.locator("[data-inventory-card='item']").first()).toContainText("Zebra lamp");
  await expect(overview.getByTestId("recent-item").first()).toContainText("Zebra lamp");
});

test("a failed location list can be retried and does not look empty", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let allowLocations = false;

  await page.route(/\/api\/v1\/entities(\?|$)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (url.searchParams.get("isLocation") !== "true" || url.searchParams.get("filterChildren") !== "true") {
      await route.continue();
      return;
    }
    if (!allowLocations) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "locations unavailable" }),
      });
      return;
    }
    await fulfillJson(route, listBody(ROOTS));
  });

  await login(page);
  await choosePurrfect(page);
  await page.goto("/home");

  const spaces = page.getByTestId("explore-spaces");
  await expect(spaces.getByTestId("locations-state")).toHaveAttribute("data-state", "error");
  await expect(spaces.locator("[data-inventory-card='location']")).toHaveCount(0);
  await expect(spaces).not.toContainText("No Locations Found");
  await expect(spaces.getByTestId("browse-locations")).toHaveAttribute("href", "/locations");
  await expect(page.getByTestId("purrfect-search")).toBeVisible();

  allowLocations = true;
  await spaces.getByTestId("locations-retry").click();
  await expect(spaces.getByTestId("locations-state")).toHaveAttribute("data-state", "ready");
  await expect(spaces.locator("[data-inventory-card='location']")).toHaveCount(2);
  await expect(spaces.getByTestId("location-link").first()).toHaveAttribute("href", `/location/${KITCHEN}`);
});

test("switching collections shows the selected collection and ignores a late previous response", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page);
  const created = await page.evaluate(async () => {
    const name = `Overview Collection B ${Date.now()}`;
    const response = await fetch("/api/v1/groups", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = (await response.json().catch(() => null)) as { id?: string; name?: string } | null;
    return { ok: response.ok, status: response.status, id: body?.id ?? "", name: body?.name || name };
  });
  expect(created.ok, `create collection failed: ${created.status}`).toBe(true);
  const collectionB = created.id;
  const collectionBName = created.name || "Overview Collection B";

  const pendingA: Array<() => void> = [];
  let releaseLateA = false;

  await page.route("**/groups/statistics", async route => {
    if (route.request().method() !== "GET" || route.request().url().includes("/statistics/")) {
      await route.continue();
      return;
    }
    const tenant = route.request().headers()["x-tenant"] ?? "";
    if (tenant === collectionB) {
      await fulfillJson(route, statisticsBody(2, 1, 1, 5));
      return;
    }
    if (!releaseLateA) {
      await new Promise<void>(resolve => pendingA.push(resolve));
    }
    await fulfillJson(route, statisticsBody(17, 6, 9, 321.5));
  });
  await page.route(/\/api\/v1\/entities(\?|$)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const tenant = route.request().headers()["x-tenant"] ?? "";
    if (
      tenant === collectionB &&
      (url.searchParams.get("orderBy") === "createdAt" || url.searchParams.get("isLocation") === "true")
    ) {
      await fulfillJson(route, listBody([]));
      return;
    }
    if (url.searchParams.get("orderBy") === "createdAt") {
      await fulfillJson(route, listBody(RECENT));
      return;
    }
    if (url.searchParams.get("isLocation") === "true" && url.searchParams.get("filterChildren") === "true") {
      await fulfillJson(route, listBody(ROOTS));
      return;
    }
    await route.continue();
  });

  await choosePurrfect(page);
  await page.goto("/home");
  releaseLateA = true;
  pendingA.splice(0).forEach(release => release());
  const overview = page.locator("[data-overview='purrfect']");
  await expect(overview.locator("[data-stat='items'] dd")).toHaveText("17");

  releaseLateA = false;
  await page.getByRole("combobox", { name: "Select Collection" }).click();
  await page.getByRole("option", { name: collectionBName }).click();
  await expect(page.getByTestId("overview-kicker")).toContainText(collectionBName);
  await expect(overview.locator("[data-stat='items'] dd")).toHaveText("2");
  await expect(overview.locator("[data-inventory-card='item']")).toHaveCount(0);
  await expect(overview).not.toContainText("Zebra lamp");

  releaseLateA = true;
  pendingA.splice(0).forEach(release => release());
  await page.waitForTimeout(500);
  await expect(overview.locator("[data-stat='items'] dd")).toHaveText("2");
  await expect(overview.getByTestId("overview-kicker")).toContainText(collectionBName);
  await expect(overview.getByTestId("browse-items")).toHaveAttribute("href", "/items");
  await expect(page.getByTestId("purrfect-add-item")).toBeEnabled();
});

test("an inventory mutation refreshes overview counts and the recent subset", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  let mutated = false;

  await page.route(/\/api\/v1\/entities(\?|$)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    if (url.searchParams.get("orderBy") !== "createdAt") {
      await route.continue();
      return;
    }
    const items = mutated
      ? [item("mutant00-0000-4000-8000-000000000001", "Mutation marker lamp", KITCHEN, "Kitchen", 1, 3, []), ...RECENT]
      : RECENT;
    await fulfillJson(route, listBody(items.slice(0, 5)));
  });
  await page.route("**/groups/statistics", async route => {
    if (route.request().method() !== "GET" || route.request().url().includes("/statistics/")) {
      await route.continue();
      return;
    }
    await fulfillJson(route, statisticsBody(mutated ? 18 : 17));
  });

  await login(page);
  await choosePurrfect(page);
  await page.goto("/home");
  const overview = page.locator("[data-overview='purrfect']");
  await expect(overview.locator("[data-stat='items'] dd")).toHaveText("17");
  await expect(overview.getByTestId("recent-item").first()).toContainText("Zebra lamp");

  mutated = true;
  const created = await page.evaluate(async () => {
    const response = await fetch("/api/v1/entities", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mutation marker lamp", quantity: 1 }),
    });
    return response.ok;
  });
  expect(created).toBe(true);
  await expect(overview.locator("[data-stat='items'] dd")).toHaveText("18");
  await expect(overview.getByTestId("recent-item").first()).toContainText("Mutation marker lamp");
  await expect(overview.locator("[data-inventory-card='item']").first()).toContainText("Mutation marker lamp");
});
