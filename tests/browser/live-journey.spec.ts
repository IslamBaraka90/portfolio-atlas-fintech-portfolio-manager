import { expect, test } from "@playwright/test";

test("live runtime desk shows demo policy, session evidence and a recorded manual cycle", async ({
  page,
}) => {
  await page.goto("/#live");
  await expect(
    page.getByRole("heading", { name: "Know how fresh every number is." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Market data: demo, refresh end of day/ }),
  ).toBeVisible();
  await expect(page.getByText("Demo data", { exact: true })).toBeVisible();
  await expect(page.getByText("Event stream: connected")).toBeVisible();
  await expect(page.getByText("Refresh cadence (LIVE_REFRESH)")).toBeVisible();
  await expect(
    page.getByText("Holidays and half days are not modeled.", { exact: false }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Refresh now" }).click();
  const manual = page.getByRole("row").filter({ hasText: "manual" }).first();
  await expect(manual).toContainText("completed");
  await expect(manual).toContainText("provider-probe");
  await expect(manual).toContainText("Demo mode serves synthetic fixtures");

  // The course rail lists Part V and marks the current chapter.
  await expect(page.getByRole("link", { name: "Live runtime", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
});
