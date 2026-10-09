import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demodemo";

async function login(page: Page) {
  await page.goto("/home");
  await page.fill("input[type='text']", DEMO_EMAIL);
  await page.fill("input[type='password']", DEMO_PASSWORD);
  await page.click("button[type='submit']");
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
