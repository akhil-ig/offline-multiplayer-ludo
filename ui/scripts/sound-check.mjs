// Verifies the audio/haptics wiring in a headless browser: the AudioContext
// starts after a user gesture, effects fire on the expected events, and the
// toggles silence them.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.goto(`${base}/?debug`, { waitUntil: 'networkidle' })
const before = await page.evaluate(() => window.__ludo.sound.state)
await page.locator('[data-count="2"]').click()
await page.locator('[data-action="start"]').click()
await page.waitForSelector('.app')
await page.waitForFunction(() => window.__ludo.sound.state === 'running', null, { timeout: 3000 })
const afterGesture = await page.evaluate(() => window.__ludo.sound.state)

const count = () => page.evaluate(() => window.__ludo.sound.played)
const c0 = await count()
await page.locator('[data-debug-toggle]').click()
await page.locator('[data-force="6"]').click()
await page.waitForFunction(() => document.querySelector('.app')?.dataset.phase === 'move', null, { timeout: 4000 })
const afterDice = await count()
await page.locator('[data-token="red-0"]').click()
await page.waitForFunction(() => document.querySelector('[data-token="red-0"]')?.dataset.pos === '0', null, { timeout: 4000 })
await page.waitForFunction(() => document.querySelector('.app')?.dataset.busy === 'false', null, { timeout: 4000 })
const afterUnlock = await count()

// Mute and roll again: no new effects.
await page.locator('[aria-label="toggle sound"]').click()
const muted0 = await count()
await page.locator('[data-force="2"]').click()
await page.waitForFunction(() => document.querySelector('.app')?.dataset.busy === 'false' && document.querySelector('.app')?.dataset.phase === 'roll', null, { timeout: 6000 })
const muted1 = await count()

const hapticsSupported = await page.evaluate(() => typeof navigator.vibrate === 'function')
const haptFired = await page.evaluate(() => window.__ludo.haptics.fired)

console.log(`ctx before=${before} after=${afterGesture} dice=${afterDice - c0} unlock=${afterUnlock - afterDice} muted=${muted1 - muted0} vibrateApi=${hapticsSupported} haptics=${haptFired} errors=${errors.length}`)
if (errors.length) console.log(errors.join('\n'))
const ok = afterGesture === 'running' && afterDice - c0 >= 1 && afterUnlock - afterDice >= 1 && muted1 - muted0 === 0 && errors.length === 0 && (!hapticsSupported || haptFired > 0)
await browser.close()
console.log(ok ? 'sound check passed' : 'sound check FAILED')
process.exit(ok ? 0 : 1)
