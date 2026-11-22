import { expect, test } from '@playwright/test'

test('dashboard shows KPIs and live events', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Robots online/i)).toBeVisible()
  await expect(page.getByTestId('connection-chip')).toContainText(/Live|Mock/)
  await expect(page.getByTestId('event-list')).toBeVisible()
})

test('fleet map renders the twin and selecting a robot opens the panel', async ({ page }) => {
  await page.goto('/fleet/map')
  const canvas = page.getByTestId('twin-canvas')
  await expect(canvas).toBeVisible()
  await page.waitForFunction(() => window.__woc !== undefined)
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Top' }).click()
  await page.waitForTimeout(500)
  const pos = await page.evaluate(() => window.__woc!.robotScreenPos(20))
  await canvas.click({ position: pos })
  await expect(page.getByTestId('robot-panel')).toBeVisible()
  await expect(page.getByTestId('robot-panel')).toContainText('R-021')
})

test('fleet table filters rows', async ({ page }) => {
  await page.goto('/fleet')
  const count = page.getByTestId('row-count')
  await expect(count).toContainText('200')
  await page.getByLabel('Search by ID').fill('R-02')
  await expect(count).not.toContainText('200')
  await expect(page.getByTestId('fleet-row').first()).toContainText('R-02')
})

test('order drawer opens with a task timeline', async ({ page }) => {
  await page.goto('/orders')
  await page.getByRole('button', { name: 'New demo order' }).click()
  await page.getByTestId('order-row').first().click()
  await expect(page.getByTestId('order-drawer')).toBeVisible()
  await expect(page.getByTestId('task-timeline')).toBeVisible()
})

test('handheld simulate scan advances the pick task', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/handheld')
  const loc = page.getByTestId('pick-location')
  await expect(loc).toBeVisible({ timeout: 45_000 })
  const before = await page.getByTestId('pick-sku').innerText()
  await page.getByRole('button', { name: 'Simulate scan' }).click()
  await expect(page.getByTestId('pick-sku')).not.toHaveText(before, { timeout: 45_000 })
})
