// Visual + performance smoke check of the animation system.
// Headless Chromium renders in software, so the fps number is only a regression guard;
// the real 60fps check happens on a phone (see PLAN.md M5).
// Stages a capture (red hops 4 cells onto yellow, yellow zips home), screenshots
// mid-hop / mid-zip / banner, and measures frame rate under 4x CPU throttling.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const base = process.argv[2] ?? 'http://localhost:4173'
const out = process.argv[3] ?? '../docs/screenshots'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/?debug`, { waitUntil: 'networkidle' })
await page.locator('[data-count="2"]').click()
await page.locator('[data-action="start"]').click()
await page.waitForSelector('.app')

// Stage: red token 0 on cell 1, yellow token 0 on absolute cell 5 (relative 31 for yellow).
await page.evaluate(() => {
  const { game } = window.__ludo
  game.debugSetTokens('red', [1, -1, -1, -1])
  game.debugSetTokens('yellow', [31, -1, -1, -1])
})
await page.waitForFunction(() => document.querySelector('[data-token="yellow-0"]')?.dataset.pos === '31')

// Dice tumble screenshot.
await page.locator('[data-debug-toggle]').click()
const t0 = Date.now()
await page.locator('[data-force="4"]').click()
await page.waitForTimeout(180)
await page.screenshot({ path: `${out}/anim-dice-tumble.png` })

// Frame-rate measurement across the move under 4x CPU throttling.
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
const fpsPromise = page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0
      const start = performance.now()
      const tick = () => {
        frames++
        if (performance.now() - start < 1200) requestAnimationFrame(tick)
        else resolve((frames / (performance.now() - start)) * 1000)
      }
      requestAnimationFrame(tick)
    }),
)

// Red auto-moves (single legal token) after the dice settles: ~450ms roll + 380ms delay.
await page.waitForFunction(() => document.querySelector('[data-token="red-0"]')?.dataset.pos === '3', null, { timeout: 4000 })
await page.screenshot({ path: `${out}/anim-mid-hop.png` })
await page.waitForFunction(() => document.querySelector('.stage--shake') || document.querySelector('.burst'), null, { timeout: 4000 })
await page.screenshot({ path: `${out}/anim-capture-burst.png` })
await page.waitForFunction(() => {
  const p = Number(document.querySelector('[data-token="yellow-0"]')?.dataset.pos)
  return p > 5 && p < 20
}, null, { timeout: 4000 })
await page.screenshot({ path: `${out}/anim-mid-zip.png` })
await page.waitForSelector('[data-banner]', { timeout: 4000 })
await page.screenshot({ path: `${out}/anim-banner.png` })
const fps = await fpsPromise
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

await page.waitForFunction(() => document.querySelector('[data-token="yellow-0"]')?.dataset.pos === '-1', null, { timeout: 6000 })
await page.waitForFunction(() => document.querySelector('.app')?.dataset.busy === 'false', null, { timeout: 6000 })
const finalRed = await page.locator('[data-token="red-0"]').getAttribute('data-pos')
const turn = await page.locator('.app').getAttribute('data-turn')
const phase = await page.locator('.app').getAttribute('data-phase')

console.log(`elapsed=${Date.now() - t0}ms fps(4x throttled)=${fps.toFixed(1)} red-0=${finalRed} yellow-0=-1 turn=${turn} phase=${phase} errors=${errors.length}`)
if (errors.length) console.log(errors.join('\n'))
const ok = fps >= 35 && finalRed === '5' && turn === 'red' && phase === 'roll' && errors.length === 0
await browser.close()
console.log(ok ? 'anim check passed' : 'anim check FAILED')
process.exit(ok ? 0 : 1)
