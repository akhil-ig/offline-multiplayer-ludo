// Usage: node scripts/screenshot.mjs <baseUrl> <outDir>
// Captures the app at phone and desktop sizes for visual review.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv[2] ?? 'http://localhost:4173'
const out = process.argv[3] ?? 'screenshots'
mkdirSync(out, { recursive: true })

const sizes = [
  { name: 'phone-390x844', width: 390, height: 844, mobile: true },
  { name: 'desktop-1280x800', width: 1280, height: 800, mobile: false },
]

const browser = await chromium.launch()
for (const s of sizes) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    isMobile: s.mobile,
    hasTouch: s.mobile,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.screenshot({ path: join(out, `${s.name}-setup.png`) })
  await page.locator('[data-action="start"]').click()
  await page.waitForSelector('[data-token="red-0"]')
  await page.screenshot({ path: join(out, `${s.name}.png`) })
  const tokenCount = await page.locator('[data-token]').count()
  const trackCount = await page.locator('[data-track]').count()
  console.log(`${s.name}: tokens=${tokenCount} trackCells=${trackCount} errors=${errors.length}`)
  if (errors.length) console.log(errors.join('\n'))
  await ctx.close()
}
await browser.close()
