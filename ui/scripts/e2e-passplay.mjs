// End-to-end check of the pass-and-play flow through the real UI.
// Usage: PLAYWRIGHT_PATH=/opt/node-tools/node_modules/playwright node scripts/e2e-passplay.mjs http://localhost:4173
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

let step = 0
const check = async (name, fn) => {
  step++
  try {
    await fn()
    console.log(`ok ${step} - ${name}`)
  } catch (e) {
    console.log(`FAIL ${step} - ${name}\n   ${e.message}`)
    await page.screenshot({ path: `/tmp/claude-0/-home-user/10fc564a-c358-581d-aa8a-09534058c819/scratchpad/e2e-fail-${step}.png` })
    await browser.close()
    process.exit(1)
  }
}
const tok = (id) => page.locator(`[data-token="${id}"]`)
const waitPos = (id, pos) => page.waitForFunction(([id, pos]) => document.querySelector(`[data-token="${id}"]`)?.dataset.pos === String(pos), [id, pos], { timeout: 4000 })
const waitTurn = (color) => page.waitForFunction((c) => document.querySelector('.app')?.dataset.turn === c, color, { timeout: 4000 })
const waitPhase = (p) => page.waitForFunction((p) => document.querySelector('.app')?.dataset.phase === p, p, { timeout: 4000 })
const force = async (n) => {
  await page.locator(`[data-force="${n}"]`).click()
}
const openDebug = async () => {
  const panel = page.locator('[data-force="1"]')
  if (!(await panel.count())) await page.locator('[data-debug-toggle]').click()
}

await page.goto(`${base}/?debug`, { waitUntil: 'networkidle' })

await check('setup: start a 2-player game with a custom name', async () => {
  await page.locator('[data-count="2"]').click()
  await page.locator('[data-name="red"]').fill('Akhil')
  await page.locator('[data-action="start"]').click()
  await page.waitForSelector('.app')
  if ((await page.locator('[data-token]').count()) !== 8) throw new Error('expected 8 tokens')
  await waitTurn('red')
  const name = await page.locator('[data-player="red"] .card__name').innerText()
  if (!name.includes('Akhil')) throw new Error(`name not applied: ${name}`)
})

await check('roll 6: four red tokens become movable, tap one to unlock', async () => {
  await openDebug()
  await force(6)
  await waitPhase('move')
  const movable = await page.locator('[data-token^="red"]:not([disabled])').count()
  if (movable !== 4) throw new Error(`expected 4 movable, got ${movable}`)
  await tok('red-0').click()
  await waitPos('red-0', 0)
  await waitPhase('roll')
  await waitTurn('red')
  await page.waitForSelector('[data-banner]', { timeout: 4000 }) // "SIX! ROLL AGAIN"
})

await check('second 6 unlocks another token', async () => {
  await force(6)
  await waitPhase('move')
  await tok('red-1').click()
  await waitPos('red-1', 0)
  await waitTurn('red')
})

await check('third 6 forfeits the turn to yellow', async () => {
  await force(6)
  await page.waitForFunction(() => document.querySelector('[data-banner]')?.textContent?.includes('THREE 6s'), null, { timeout: 4000 })
  await waitTurn('yellow')
  await waitPhase('roll')
})

await check('yellow rolls 3 with everything in the yard: turn passes back', async () => {
  await force(3)
  await waitTurn('red')
})

await check('red rolls 4: two legal tokens, tap red-0, lands on 4, turn passes', async () => {
  await force(4)
  await waitPhase('move')
  const movable = await page.locator('[data-token^="red"]:not([disabled])').count()
  if (movable !== 2) throw new Error(`expected 2 movable, got ${movable}`)
  await tok('red-0').click()
  await waitPos('red-0', 4)
  await waitTurn('yellow')
})

await check('reload: game resumes from localStorage with the same positions', async () => {
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-action="resume"]').click()
  await page.waitForSelector('.app')
  await waitPos('red-0', 4)
  await waitPos('red-1', 0)
  await waitTurn('yellow')
})

await check('real dice button works for the player on turn', async () => {
  const before = await page.locator('.app').getAttribute('data-phase')
  if (before !== 'roll') throw new Error('expected roll phase')
  await page.locator('[data-player="yellow"] .dice').click({ force: true })
  await page.waitForFunction(() => {
    const a = document.querySelector('.app')
    return a?.dataset.phase === 'move' || a?.dataset.turn === 'red'
  }, null, { timeout: 4000 })
  // If yellow rolled a 6 it must move; play it out by tapping the first movable token.
  if ((await page.locator('.app').getAttribute('data-phase')) === 'move') {
    await page.locator('[data-token^="yellow"]:not([disabled])').first().click()
  }
})

await check('endgame preset + exact roll auto-moves the lone token and shows the win screen', async () => {
  await page.waitForFunction(() => document.querySelector('.app')?.dataset.phase === 'roll', null, { timeout: 4000 })
  const who = await page.locator('.app').getAttribute('data-turn')
  await openDebug()
  await page.locator('[data-debug-endgame]').click()
  await force(2)
  await page.waitForSelector('[data-win]', { timeout: 5000 })
  const title = await page.locator('[data-win] h2').innerText()
  const expected = who === 'red' ? 'Akhil' : 'Yellow'
  if (!title.includes(expected)) throw new Error(`expected ${expected} to win, got "${title}"`)
})

await check('play again starts a fresh game and the save is cleared', async () => {
  await page.locator('[data-action="again"]').click()
  await page.waitForSelector('.app')
  await waitPos('red-0', -1)
  const saved = await page.evaluate(() => localStorage.getItem('ludo.game.v1'))
  if (!saved) throw new Error('new game should be saved immediately')
  await page.locator('[data-action="menu"]').count() // win screen gone
  if (await page.locator('[data-win]').count()) throw new Error('win screen still visible')
})

await check('no console errors during the whole flow', async () => {
  if (errors.length) throw new Error(errors.join('\n'))
})

await page.screenshot({ path: '../docs/screenshots/phone-ingame.png' })
await browser.close()
console.log('e2e passed')
