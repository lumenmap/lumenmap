import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 320, height: 600 } });
test('debug overflow', async ({ page }) => {
  await page.goto('http://127.0.0.1:3100');
  await page.waitForTimeout(2000);
  const overflowElements = await page.evaluate((vpWidth) => {
    const all = document.querySelectorAll("*");
    const overflowing: string[] = [];
    for (const el of all) {
      if (el.scrollWidth > el.clientWidth && el.scrollWidth > vpWidth * 0.5) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = Array.from((el as HTMLElement).classList).slice(0, 2).join(".");
        overflowing.push(`${tag}${id}${cls ? `.${cls}` : ""} scrollW=${el.scrollWidth} clientW=${el.clientWidth}`);
      }
    }
    return overflowing;
  }, 320);
  console.log("Overflowing:", overflowElements);
});
