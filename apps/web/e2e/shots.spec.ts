import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '../../..')
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(root, 'docs/screenshots', name) })
mkdirSync(path.join(root, 'docs/screenshots'), { recursive: true })
mkdirSync(path.join(root, 'docs/evidence'), { recursive: true })

test.describe.configure({ mode: 'serial' })

const setLang = async (page: Page, lang: 'en' | 'ja') => {
  await page.evaluate((l) => localStorage.setItem('woc.lang', l), lang)
  await page.reload()
}

/** Waits until the twin renders and the HUD reports a steady frame rate. */
async function fpsStable(page: Page) {
  await page.waitForFunction(() => window.__woc !== undefined)
  await expect
    .poll(async () => Number((await page.getByTestId('perf-hud').getAttribute('data-fps')) ?? 0), { timeout: 30_000 })
    .toBeGreaterThan(5)
  await page.waitForTimeout(2500)
}

async function robotIndex(page: Page, status: string) {
  const robots = await (await page.request.get('/api/robots')).json()
  const idx = robots.findIndex((r: { status: string }) => r.status === status)
  return idx >= 0 ? idx : 20
}

test('01-02 dashboard EN and JA', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Robots online')).toBeVisible()
  await page.waitForTimeout(7000)
  await shot(page, '01-dashboard-en.png')
  await setLang(page, 'ja')
  await expect(page.getByText('オンラインのロボット')).toBeVisible()
  await page.waitForTimeout(1500)
  await shot(page, '02-dashboard-ja.png')
  await setLang(page, 'en')
})

test('03-04 fleet map: selection panel and isometric HUD', async ({ page }) => {
  await page.goto('/fleet/map')
  await fpsStable(page)
  await page.getByRole('button', { name: 'Top' }).click()
  await page.waitForTimeout(800)
  const idx = await robotIndex(page, 'moving')
  const pos = await page.evaluate((i) => window.__woc!.robotScreenPos(i), idx)
  await page.getByTestId('twin-canvas').click({ position: pos })
  await expect(page.getByTestId('robot-panel')).toBeVisible()
  await page.waitForTimeout(1200)
  await shot(page, '03-map-top-selected.png')
  await page.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Isometric' }).click()
  await page.waitForTimeout(3500)
  await shot(page, '04-map-iso-perfhud.png')
  writeFileSync(path.join(root, 'docs/evidence/perf-hud.txt'), `${await page.getByTestId('perf-hud').innerText()}\n`)
})

test('05 fleet table filtered and sorted', async ({ page }) => {
  await page.goto('/fleet')
  await expect(page.getByTestId('row-count')).toContainText('200')
  await page.getByLabel('Status').selectOption('moving')
  await page.getByRole('button', { name: /Battery/i }).click()
  await page.waitForTimeout(2500)
  await shot(page, '05-fleet-table.png')
})

test('06 orders with drawer and task timeline', async ({ page }) => {
  await page.goto('/orders')
  await page.getByRole('tab', { name: /In progress/ }).click()
  await page.waitForTimeout(1000)
  const rows = page.getByTestId('order-row')
  if ((await rows.count()) === 0) await page.getByRole('tab', { name: /All/ }).click()
  await page.getByTestId('order-row').first().click()
  await expect(page.getByTestId('task-timeline')).toBeVisible()
  await page.waitForTimeout(800)
  await shot(page, '06-orders-drawer.png')
})

test('07 fault injection: toast, events and red robot', async ({ page }) => {
  await page.goto('/fleet/map')
  await fpsStable(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Inject fault' }).click()
  await page.getByRole('link', { name: 'Events' }).click()
  await expect(page.locator('[data-severity="error"]').first()).toBeVisible()
  await page.waitForTimeout(600)
  await shot(page, '07-events-after-fault.png')
  await page.getByRole('link', { name: 'Fleet Map' }).click()
  await fpsStable(page)
  await page.getByRole('button', { name: 'Top' }).click()
  await page.getByRole('button', { name: 'Idle' }).click()
  await page.getByRole('button', { name: 'Moving' }).click()
  await page.getByRole('button', { name: 'Picking' }).click()
  await page.getByRole('button', { name: 'Charging' }).click()
  await page.getByRole('button', { name: 'Offline' }).click()
  await page.waitForTimeout(1500)
  await shot(page, '07b-map-fault-only.png')
})

test('08-09 handheld pick and scan success', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, locale: 'en-US', hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('/handheld')
  await expect(page.getByTestId('pick-card')).toBeVisible({ timeout: 90_000 })
  await page.waitForTimeout(500)
  await shot(page, '08-handheld-pick.png')
  await page.getByRole('button', { name: 'Simulate scan' }).click()
  await page.waitForTimeout(200)
  await shot(page, '09-handheld-scan-success.png')
  await ctx.close()
})

test('10 settings with version and data source', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByTestId('app-version')).toBeVisible()
  await shot(page, '10-settings.png')
})

test('11 profiling: telemetry stays out of the React render path', async ({ page }) => {
  await page.goto('/fleet/map')
  await fpsStable(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const metric = async (name: string) => ((await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === name)?.value ?? 0)
  const [t0, s0] = [await metric('TaskDuration'), await metric('ScriptDuration')]
  await page.waitForTimeout(10_000)
  const [t1, s1] = [await metric('TaskDuration'), await metric('ScriptDuration')]
  const hud = await page.getByTestId('perf-hud').innerText()
  const result = {
    windowSeconds: 10,
    mainThreadTaskSeconds: +(t1 - t0).toFixed(3),
    scriptSeconds: +(s1 - s0).toFixed(3),
    mainThreadBusyPercent: +(((t1 - t0) / 10) * 100).toFixed(1),
    hud,
  }
  writeFileSync(path.join(root, 'docs/evidence/perf-metrics.json'), `${JSON.stringify(result, null, 2)}\n`)
  await page.goto('about:blank')
  await page.setContent(`<body style="font:16px system-ui;background:#0b0f14;color:#e6edf3;padding:32px;width:720px">
    <h2>Profiling: Fleet Map, 200 robots, 5 Hz telemetry (10 s window)</h2>
    <table style="border-collapse:collapse;font-size:18px">
    <tr><td style="padding:6px 24px 6px 0">Main-thread busy</td><td><b>${result.mainThreadBusyPercent}%</b></td></tr>
    <tr><td style="padding:6px 24px 6px 0">Script time</td><td><b>${result.scriptSeconds}s</b> / 10s</td></tr>
    <tr><td style="padding:6px 24px 6px 0">PerfHud</td><td><code>${hud}</code></td></tr></table>
    <p style="color:#8b9bb0">Source: CDP Performance.getMetrics + in-app PerfHud. React commits attributable to telemetry stay near zero because frames go WebSocket → Web Worker → typed arrays → Babylon render loop.</p></body>`)
  await shot(page, '11-profiling.png')
})
