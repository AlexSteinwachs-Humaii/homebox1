import { expect, test, type Page, type Route } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

const ROOM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const BRANCH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const SHELF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const CARRIER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const BOWL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const ITEM_TYPE = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const TEMPLATE = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const TAG = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function location(id: string, name: string, parentId: string | null) {
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
    entityType: { id: "loc-type", name: "Place", color: "#888888", isLocation: true },
  };
}

function belonging(id: string, name: string, parentId: string, price: number | null, imageId: string | null = null) {
  return {
    id,
    name,
    description: "",
    quantity: 1,
    purchasePrice: price,
    archived: false,
    insured: false,
    assetId: "000-001",
    imageId,
    thumbnailId: imageId,
    tags: [],
    parent: { id: parentId, name: parentId },
    createdAt: "2026-01-08T12:00:00Z",
    updatedAt: "2026-03-02T12:00:00Z",
    entityType: { id: ITEM_TYPE, name: "Item", color: "#888888", isLocation: false },
  };
}

const locations = [
  location(ROOM, "Utility room", null),
  location(BRANCH, "Pet supplies", ROOM),
  location(SHELF, "Top shelf", BRANCH),
  location(OTHER, "Spare bin", ROOM),
];

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

function fulfill(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApi(page: Page, options: { failShelf?: boolean; shelf?: ReturnType<typeof belonging>[] } = {}) {
  const shelf = options.shelf ?? [
    belonging(CARRIER, "Cat carrier", SHELF, 68),
    belonging(BOWL, "Food container", SHELF, 24, null),
  ];
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith("/users/self") || path.endsWith("/users/login") || path.includes("/status")) {
      await route.continue();
      return;
    }
    if (path.endsWith("/entity-types") && method === "GET") {
      await fulfill(route, [
        {
          id: ITEM_TYPE,
          name: "Item",
          color: "#888888",
          isLocation: false,
          description: "",
          icon: "",
          defaultTemplateId: "",
          createdAt: "2026-01-08T12:00:00Z",
          updatedAt: "2026-01-08T12:00:00Z",
        },
      ]);
      return;
    }
    if (path.endsWith("/tags") && method === "GET") {
      await fulfill(route, [{ id: TAG, name: "Household", color: "#cccccc" }]);
      return;
    }
    if (path.endsWith("/templates") && method === "GET") {
      await fulfill(route, []);
      return;
    }
    if (path.endsWith(`/templates/${TEMPLATE}`) && method === "GET") {
      await fulfill(route, {
        id: TEMPLATE,
        name: "Carrier template",
        description: "",
        defaultName: "Soft carrier",
        defaultDescription: "Folded carrier",
        defaultQuantity: 2,
        defaultInsured: true,
        defaultLocation: { id: OTHER, name: "Spare bin" },
        defaultTags: [{ id: TAG, name: "Household" }],
        defaultManufacturer: "",
        defaultModelNumber: "",
        fields: [],
        createdAt: "2026-01-08T12:00:00Z",
        updatedAt: "2026-01-08T12:00:00Z",
      });
      return;
    }
    if (url.searchParams.get("isLocation") === "true") {
      await fulfill(route, { items: locations, page: 1, pageSize: locations.length, total: locations.length });
      return;
    }
    if (path.endsWith("/tree")) {
      await fulfill(route, [
        {
          id: ROOM,
          name: "Utility room",
          children: [
            {
              id: BRANCH,
              name: "Pet supplies",
              children: [{ id: SHELF, name: "Top shelf", children: [] }],
            },
            { id: OTHER, name: "Spare bin", children: [] },
          ],
        },
      ]);
      return;
    }
    if (method === "GET" && url.searchParams.getAll("parentIds").length > 0) {
      if (options.failShelf) {
        await fulfill(route, { error: "unavailable" }, 500);
        return;
      }
      const parents = url.searchParams.getAll("parentIds");
      const matched = shelf.filter(item => item.parent && parents.includes(item.parent.id));
      await fulfill(route, { items: matched, page: 1, pageSize: 50, total: matched.length });
      return;
    }
    if (method === "POST" && path.endsWith("/entities")) {
      await fulfill(route, { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "Created" });
      return;
    }
    await route.continue();
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("contextual add opens the design form with the real shelf, not the sample mat", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await choosePurrfect(page);
  await installApi(page);
  await page.goto(`/item/add?rootLocationId=${ROOM}&branchId=${BRANCH}&destinationId=${SHELF}`);

  const form = page.getByTestId("create-entity-form");
  await expect(form).toBeVisible({ timeout: 30_000 });
  await expect(form).toHaveAttribute("data-contextual", "true");
  await expect(form).toHaveAttribute("data-destination-id", SHELF);
  await expect(form).toHaveAttribute("data-root-id", ROOM);
  await expect(page.getByTestId("add-item-name").locator("input")).toHaveValue("");
  await expect(page.getByTestId("add-item-description").locator("textarea")).toHaveValue("");
  await expect(page.getByTestId("add-item-price").locator("input")).toHaveValue("");
  await expect(page.getByTestId("add-item-vendor").locator("input")).toHaveValue("");
  await expect(page.getByTestId("add-item-location-path")).toContainText("Top shelf");
  await expect(page.getByTestId("add-item-illustration")).toHaveAttribute("data-upload", "false");
  await expect(page.locator("input[type='file']")).toHaveCount(0);

  const shelf = page.getByTestId("shelf-preview");
  await expect(shelf).toHaveAttribute("data-state", "ready");
  await expect(shelf.getByTestId("shelf-item")).toHaveCount(2);
  await expect(shelf).toContainText("Cat carrier");
  await expect(shelf).toContainText("Food container");
  await expect(shelf.getByTestId("shelf-item").nth(1).locator("[data-image-fallback]")).toBeVisible();

  await page.getByTestId("add-item-change-location").click();
  await form.getByRole("combobox").click();
  await page.getByText("Spare bin", { exact: true }).click();
  await expect(form).toHaveAttribute("data-destination-id", OTHER);
  await expect(page.getByTestId("add-item-name").locator("input")).toHaveValue("");
  await expect(shelf).toHaveAttribute("data-state", "empty");
});

test("a missing shelf, an empty shelf, and a failed preview stay honest", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await choosePurrfect(page);
  await installApi(page, { shelf: [] });
  await page.goto(`/item/add?destinationId=${SHELF}`);
  const form = page.getByTestId("create-entity-form");
  await expect(form).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("shelf-preview")).toHaveAttribute("data-state", "empty");

  await page.goto(`/item/add?destinationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb99`);
  await expect(page.getByTestId("add-location-rejected")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("shelf-preview")).toHaveAttribute("data-state", "absent");
  await expect(page.getByTestId("add-item-name").locator("input")).toHaveValue("");
});

test("a failed shelf preview is an error, not an empty shelf", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await choosePurrfect(page);
  await installApi(page, { failShelf: true });
  await page.goto(`/item/add?destinationId=${SHELF}`);
  await expect(page.getByTestId("shelf-preview")).toHaveAttribute("data-state", "error", { timeout: 30_000 });
  await expect(page.getByTestId("add-item-name").locator("input")).toHaveValue("");
  await expect(page.getByTestId("shelf-item")).toHaveCount(0);
});

test("global add keeps a blank draft and still reaches barcode and location create", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await choosePurrfect(page);
  await installApi(page);
  await page.goto("/home");
  await page.getByTestId("purrfect-add-item").click();
  await expect(page).toHaveURL(/\/item\/add/);
  const form = page.getByTestId("create-entity-form");
  await expect(form).toHaveAttribute("data-contextual", "false");
  await expect(form).toHaveAttribute("data-destination-id", "");
  await expect(page.getByTestId("add-item-name").locator("input")).toHaveValue("");
  await expect(page.getByTestId("shelf-preview")).toHaveAttribute("data-state", "absent");

  await page.getByTestId("add-item-advanced").locator("summary").click();
  await page.getByTestId("add-advanced-location").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("add-advanced-barcode").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
