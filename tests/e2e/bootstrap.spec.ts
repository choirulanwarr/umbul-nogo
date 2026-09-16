import { expect, test } from "@playwright/test";

test("SSR menyediakan identitas dan tiket tanpa JavaScript", async ({ browser, request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).toContain("Informasi harga tiket belum tersedia.");
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("UMBUL NOGO");
    await expect(page.getByRole("heading", { name: "Tiket masuk", exact: true })).toBeVisible();
    await expect(page.getByText("Informasi harga tiket belum tersedia.")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("aset, Tailwind, kontrak browser, dan hydration bekerja", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(request.url()));
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 244, 235)");
  const button = page.getByRole("button", { name: "Informasi kunjungan" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#visit-details")).toBeVisible();
  await button.click();
  await expect(page.locator("#visit-details")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const icon = await request.get("/favicon.svg");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  expect(errors).toEqual([]);
});
