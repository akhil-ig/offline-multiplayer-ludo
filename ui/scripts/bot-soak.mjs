// UI-level soak: four bots play a whole game through the real UI in turbo mode
// (no animation delays). Fails on any console error or if the game stalls.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/?debug&turbo`, { waitUntil: 'networkidle' })
for (const c of ['red', 'green', 'yellow', 'blue']) await page.locator(`[data-bot="${c}"]`).click()
await page.locator('[data-lang]').first().click() // Hindi UI for this run
await page.locator('[data-action="start"]').click()
await page.waitForSelector('.app')
const t0 = Date.now()
let lastTurn = -1
let stalls = 0
while (!(await page.locator('[data-win]').count())) {
  const turn = await page.evaluate(() => window.__ludo.game.state?.turn ?? -1)
  if (turn === lastTurn) stalls++
  else stalls = 0
  lastTurn = turn
  if (stalls > 40) throw new Error(`game stalled at turn ${turn}`)
  if (Date.now() - t0 > 180000) throw new Error('timeout')
  await page.waitForTimeout(250)
}
const turns = await page.evaluate(() => window.__ludo.game.state.turn)
const ranking = await page.evaluate(() => window.__ludo.game.state.ranking)
const title = await page.locator('[data-win] h2').innerText()
console.log(`bots finished in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${turns} rolls, ranking=${ranking.join('>')}, title="${title}", errors=${errors.length}`)
if (errors.length) console.log(errors.join('\n'))
await page.screenshot({ path: '../docs/screenshots/bot-win-hi.png' })
await browser.close()
const ok = errors.length === 0 && ranking.length === 4 && title.includes('जीत')
console.log(ok ? 'bot soak passed' : 'bot soak FAILED')
process.exit(ok ? 0 : 1)
