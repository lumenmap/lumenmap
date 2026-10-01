import { test, expect } from '@playwright/test';

import { seedFixtureData } from './fixtures/seed';

const FLOW_VIEW_LABEL = /Flow/i;
const NODE_SELECTOR = '[data-testid="flow-node"]';
const EDGE_SELECTOR = '[data-testid="flow-edge"]';
const DETAIL_PANEL_SELECTOR = '[data-testid="flow-detail-panel"]';

test.describe('Flow view (fixture mode)', () => {
  test.beforeEach(async ({ page }) => {
    await seedFixtureData(page);
    await page.goto('/');
    await page.getByRole('button', { name: FLOW_VIEW_LABEL }).click();
    await expect(page.getByTestId('flow-view')).toBeVisible();
  });

  test('renders nodes and edges', async ({ page }) => {
    await expect(page.locator(NODE_SELECTOR).first()).toBeVisible();
    await expect(page.locator(NODE_SELECTOR)).toHaveCount(3);
    await expect(page.locator(EDGE_SELECTOR).first()).toBeVisible();
    await expect(page.locator(EDGE_SELECTOR)).toHaveCount(2);
  });

  test('updates detail panel on node click', async ({ page }) => {
    const detailPanel = page.locator(DETAIL_PANEL_SELECTOR);
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.getByTestId('flow-detail-empty')).toBeVisible();

    const node = page.locator(NODE_SELECTOR).first();
    const nodeLabel = await node.getAttribute('data-node-label');
    await node.click();

    await expect(detailPanel.getByTestId('flow-detail-empty')).toBeHidden();
    await expect(detailPanel.getByTestId('flow-detail-name')).toHaveText(nodeLabel ?? /./);
  });
});
