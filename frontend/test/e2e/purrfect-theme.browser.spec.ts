import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

async function login(page: Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  const email = page.locator("input[type='email'], input[type='text']").first();
  await email.waitFor({ state: "visible" });
  await email.fill(DEMO_EMAIL);
  await page.fill("input[type='password']", DEMO_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL("/home");
}

async function cssVariable(page: Page, name: string) {
  return page.evaluate(variable => getComputedStyle(document.documentElement).getPropertyValue(variable).trim(), name);
}

test("Purrfect Home can be chosen, kept, and switched back", async ({ page }) => {
  const savedThemes: string[] = [];
  await page.route("**/users/self/settings", async route => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { theme?: string };
      if (body.theme) {
        savedThemes.push(body.theme);
      }
    }
    await route.continue();
  });

  await login(page);
  await page.goto("/profile");
  await expect(page.getByRole("radio", { name: "Purrfect Home" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Homebox" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Light" })).toBeVisible();

  const purrfect = page.locator("[data-set-theme='purrfect-home']");
  const homebox = page.locator("[data-set-theme='homebox']");
  const light = page.locator("[data-set-theme='light']");

  await homebox.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purrfect-home");
  await expect(page.locator("html")).toHaveClass(/theme-purrfect-home/);
  await expect(purrfect).toHaveAttribute("aria-checked", "true");
  await expect(purrfect).toHaveAttribute("tabindex", "0");
  await expect(homebox).toHaveAttribute("tabindex", "-1");
  await expect(purrfect.locator("[data-selected-mark]")).toBeVisible();

  await purrfect.evaluate(element => {
    const focus = (element as HTMLElement).focus.bind(element) as (options?: { focusVisible?: boolean }) => void;
    focus({ focusVisible: true });
  });
  await expect(purrfect).toHaveCSS("outline-style", "solid");
  const outlineWidth = await purrfect.evaluate(element => getComputedStyle(element).outlineWidth);
  expect(Number.parseFloat(outlineWidth)).toBeGreaterThan(0);

  await expect.poll(() => cssVariable(page, "--background")).toBe("36 56% 96%");
  await expect.poll(() => cssVariable(page, "--foreground")).toBe("264 22% 18%");
  await expect.poll(() => cssVariable(page, "--sidebar-background")).toBe("264 42% 91%");
  await expect.poll(() => cssVariable(page, "--primary")).toBe("174 65% 22%");

  await expect.poll(() => savedThemes.at(-1)).toBe("purrfect-home");
  await expect
    .poll(async () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("homebox/preferences/location") || "{}").theme)
    )
    .toBe("purrfect-home");

  await page.goto("/home");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purrfect-home");
  await expect.poll(() => cssVariable(page, "--background")).toBe("36 56% 96%");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purrfect-home");
  await expect(page.locator("html")).toHaveClass(/theme-purrfect-home/);
  await expect.poll(() => cssVariable(page, "--primary")).toBe("174 65% 22%");

  await page.goto("/profile");
  await light.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveClass(/theme-purrfect-home/);
  await expect.poll(() => cssVariable(page, "--background")).toBe("0 0% 100%");
  await expect.poll(() => cssVariable(page, "--primary")).toBe("259 94% 51%");

  await homebox.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "homebox");
  await expect(page.locator("html")).not.toHaveClass(/theme-purrfect-home/);
  await expect.poll(() => cssVariable(page, "--primary")).toBe("139 16% 43%");
  await expect.poll(() => cssVariable(page, "--sidebar-background")).toBe("0 0% 90%");
  await expect.poll(() => savedThemes.at(-1)).toBe("homebox");
});

test("Purrfect desktop shell keeps navigation, search, scan and add item", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  await expect(page.locator("[data-shell='purrfect']")).toHaveCount(0);
  await expect(page.getByPlaceholder("Search")).toBeVisible();

  await page.goto("/profile");
  await page.locator("[data-set-theme='purrfect-home']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purrfect-home");

  await page.goto("/home");
  const shell = page.locator("[data-shell='purrfect']");
  await expect(shell).toBeVisible();
  await expect(shell.getByRole("link", { name: "HomeBox" })).toBeVisible();
  await expect(shell.getByRole("combobox")).toBeVisible();

  for (const name of ["Home", "Search", "Locations", "Tags", "Templates", "Maintenance", "Collection"]) {
    await expect(shell.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await expect(shell.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(shell.getByRole("link", { name: "Profile", exact: true })).toBeVisible();
  await expect(shell.getByTestId("logout-button")).toBeVisible();

  await shell.getByRole("button", { name: "Collection sections" }).click();
  await expect(shell.getByRole("link", { name: "Members" })).toBeVisible();
  await expect(shell.getByRole("link", { name: "Tools" })).toBeVisible();

  const search = shell.getByRole("searchbox");
  await search.focus();
  await expect(search).toBeFocused();
  await search.fill("cat & carrier");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/items\?q=/);
  const searched = new URL(page.url());
  expect(searched.pathname).toBe("/items");
  expect(searched.searchParams.get("q")).toBe("cat & carrier");
  expect(searched.searchParams.get("collectionId")).toBeNull();

  await page.goto("/home");
  await page.getByTestId("purrfect-add-item").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("purrfect-scan").focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Camera permission denied").or(page.getByRole("heading", { name: "Scanner" }))
  ).toBeVisible();

  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator("[data-shell='purrfect']")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home", exact: true }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Search")).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("[data-shell='purrfect']")).toBeVisible();
});

const PHOTO_ID = "77777777-7777-4777-8777-777777777777";
const BROKEN_ID = "88888888-8888-4888-8888-888888888888";
const LONG_PARENT = "99999999-9999-4999-8999-999999999999";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test("Purrfect cards keep real metadata and honest image fallbacks", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const names: { photo?: string; broken?: string; path?: string } = {};

  await page.route(/\/api\/v1\/entities(\?|$)/, async route => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = await response.text();
    let json: { items?: Array<Record<string, unknown>> };
    try {
      json = JSON.parse(body) as { items?: Array<Record<string, unknown>> };
    } catch {
      await route.fulfill({ response, body });
      return;
    }
    const items = json.items ?? [];
    const url = route.request().url();
    const first = items[0];
    const second = items[1];
    const third = items[2];
    if (url.includes("isLocation=true") && first && second) {
      first.itemCount = 0;
      delete second.itemCount;
    }
    if (!url.includes("isLocation=true") && first && second && third) {
      first.imageId = PHOTO_ID;
      first.thumbnailId = PHOTO_ID;
      names.photo = String(first.name ?? "");
      second.imageId = BROKEN_ID;
      delete second.thumbnailId;
      names.broken = String(second.name ?? "");
      third.parent = {
        id: LONG_PARENT,
        name: "Top shelf with a very long label",
        parent: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Pet supplies",
          parent: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Utility room" },
        },
      };
      const tags = Array.isArray(third.tags) ? third.tags : [];
      third.tags = [
        ...tags,
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          name: "A very long household tag that must stay a real tag",
        },
      ];
      names.path = String(third.name ?? "");
    }
    await route.fulfill({
      status: response.status(),
      body: JSON.stringify(json),
      contentType: "application/json",
    });
  });

  await page.route(`**/attachments/${PHOTO_ID}**`, route =>
    route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG })
  );
  await page.route(`**/attachments/${BROKEN_ID}**`, route => route.fulfill({ status: 404, body: "missing" }));

  await login(page);
  await page.goto("/profile");
  await page.locator("[data-set-theme='purrfect-home']").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "purrfect-home");

  await page.goto("/home");
  const zero = page.locator("[data-inventory-card='location'][data-count-state='known'][data-count='0']").first();
  await expect(zero).toBeVisible();
  await expect(zero.getByTestId("location-count")).toHaveText("0 items");
  const unknown = page.locator("[data-inventory-card='location'][data-count-state='unknown']");
  await expect(unknown).toHaveCount(1);
  await expect(unknown).not.toContainText(/\b0 items\b/);
  await zero.getByTestId("location-link").focus();
  await expect(zero.getByTestId("location-link")).toBeFocused();

  await page.goto("/items");
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await expect(page.getByRole("button", { name: "Table", exact: true })).toBeVisible();

  const cards = page.locator("[data-inventory-card='item']");
  await expect(cards.first()).toBeVisible();
  await expect(cards.locator("img[src*='no-image']")).toHaveCount(0);
  await expect(cards.locator("[data-decorative-cat]")).toHaveCount(0);

  const photo = cards.filter({ hasText: names.photo ?? "" });
  const photoImage = photo.locator("[data-inventory-image] img").last();
  await expect(photoImage).toBeVisible();
  await expect(photoImage).toHaveAttribute("src", new RegExp(`/entities/.*/attachments/${PHOTO_ID}`));
  await expect(photoImage).toHaveAttribute("src", /access_token=/);
  await expect(photo.getByTestId("item-quantity")).toContainText("Qty");
  await expect(photo.getByTestId("item-price")).toContainText(/\d/);

  const broken = cards.filter({ hasText: names.broken ?? "" });
  await expect(broken.locator("[data-image-fallback]")).toBeVisible();
  await expect(broken.locator("[data-inventory-image] img")).toHaveCount(0);
  await expect(broken.locator("[data-image-fallback]")).toHaveAttribute("aria-label", /No photo/);

  const pathCard = cards.filter({ hasText: names.path ?? "" });
  const path = pathCard.getByTestId("location-path");
  await expect(path).toContainText("Utility room");
  await expect(path).toContainText("Pet supplies");
  await expect(path).toContainText("Top shelf with a very long label");
  await expect(path).toContainText("→");
  await expect(pathCard.getByRole("link", { name: /A very long household tag/ })).toBeVisible();

  await pathCard.getByTestId("item-link").focus();
  await expect(pathCard.getByTestId("item-link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(path).toBeFocused();
  await expect(pathCard.getByTestId("item-link").locator("a")).toHaveCount(0);

  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await expect(cards.first()).toBeVisible();
});
