// Two headless browsers play through the Rust relay: host creates a room,
// joiner joins via the QR URL, the host starts, both act, the joiner reloads
// and rejoins mid-game with identical positions.
// Usage: node scripts/lan-check.mjs <serverBinary> [port]
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const bin = process.argv[2] ?? '../server/target/debug/ludo-server'
const port = Number(process.argv[3] ?? 7979)
const base = `http://127.0.0.1:${port}`

const server = spawn(bin, ['--port', String(port), '--bind', '127.0.0.1', '--advertise', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = ''
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))
const stop = () => server.kill()
process.on('exit', stop)

// Wait for the server.
for (let i = 0; i < 50; i++) {
  try {
    const r = await fetch(`${base}/api/info`)
    if (r.ok) break
  } catch {
    /* server not up yet */
  }
  await new Promise((r) => setTimeout(r, 100))
}
const info = await (await fetch(`${base}/api/info`)).json()
console.log(`server up: joinBase=${info.joinBase} version=${info.version}`)

const browser = await chromium.launch()
const mk = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`))
  return { page, ctx, errors }
}
const A = await mk('host')
const B = await mk('joiner')
let step = 0
const check = async (name, fn) => {
  step++
  try {
    await fn()
    console.log(`ok ${step} - ${name}`)
  } catch (e) {
    console.log(`FAIL ${step} - ${name}\n   ${e.message}`)
    await A.page.screenshot({ path: `/tmp/claude-0/-home-user/10fc564a-c358-581d-aa8a-09534058c819/scratchpad/lan-fail-${step}-host.png` })
    await B.page.screenshot({ path: `/tmp/claude-0/-home-user/10fc564a-c358-581d-aa8a-09534058c819/scratchpad/lan-fail-${step}-joiner.png` })
    console.log(serverLog.slice(-1500))
    await browser.close()
    stop()
    process.exit(1)
  }
}
const posOf = (page, id) => page.evaluate((id) => document.querySelector(`[data-token="${id}"]`)?.dataset.pos, id)
const waitPos = (page, id, pos) => page.waitForFunction(([id, pos]) => document.querySelector(`[data-token="${id}"]`)?.dataset.pos === String(pos), [id, pos], { timeout: 8000 })
const waitTurn = (page, c) => page.waitForFunction((c) => document.querySelector('.app')?.dataset.turn === c, c, { timeout: 8000 })
const waitPhase = (page, p) => page.waitForFunction((p) => document.querySelector('.app')?.dataset.phase === p, p, { timeout: 8000 })
const settled = (page) => page.waitForFunction(() => document.querySelector('.app')?.dataset.busy === 'false', null, { timeout: 8000 })

let code = ''
await check('host creates a room and sees the lobby with a code and QR', async () => {
  await A.page.goto(`${base}/?debug`, { waitUntil: 'networkidle' })
  await A.page.locator('[data-lan-name]').fill('Akhil')
  await A.page.locator('[data-action="lan-host"]').click()
  await A.page.waitForSelector('[data-lobby-screen]')
  await A.page.waitForFunction(() => /^[A-Z2-9]{4}$/.test(document.querySelector('[data-room-code]')?.textContent ?? ''), null, { timeout: 5000 })
  code = await A.page.locator('[data-room-code]').innerText()
  await A.page.waitForSelector('[data-lobby-screen] canvas')
  if (!(await A.page.locator('[data-lobby-player="Akhil"]').count())) throw new Error('host not listed')
})

await check('joiner opens the QR URL, enters a name and lands in the same lobby', async () => {
  await B.page.goto(`${base}/?room=${code}`, { waitUntil: 'networkidle' })
  if ((await B.page.locator('[data-lan-code]').inputValue()) !== code) throw new Error('room code not prefilled')
  await B.page.locator('[data-lan-name]').fill('Kajal')
  await B.page.locator('[data-action="lan-join"]').click()
  await B.page.waitForSelector('[data-lobby-player="Kajal"]', { timeout: 5000 })
  await A.page.waitForSelector('[data-lobby-player="Kajal"]', { timeout: 5000 })
  if (await B.page.locator('[data-action="lan-start"]').count()) throw new Error('joiner must not see start')
})

await check('a bad room code is rejected with an error on the setup screen', async () => {
  const C = await mk('stranger')
  await C.page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await C.page.locator('[data-lan-code]').fill('ZZZZ')
  await C.page.locator('[data-action="lan-join"]').click()
  await C.page.waitForSelector('[data-lan-error]', { timeout: 5000 })
  await C.ctx.close()
})

await check('host starts: both devices show a 2-player game, red (host) on turn', async () => {
  await A.page.locator('[data-action="lan-start"]').click()
  await A.page.waitForSelector('.app[data-mode="host"]')
  await B.page.waitForSelector('.app[data-mode="join"]', { timeout: 8000 })
  for (const p of [A.page, B.page]) {
    if ((await p.locator('[data-token]').count()) !== 8) throw new Error('expected 8 tokens')
    await waitTurn(p, 'red')
  }
  const nameA = await B.page.locator('[data-player="red"] .card__name').innerText()
  if (!nameA.includes('Akhil')) throw new Error(`joiner sees wrong host name: ${nameA}`)
  const nameB = await A.page.locator('[data-player="yellow"] .card__name').innerText()
  if (!nameB.includes('Kajal')) throw new Error(`host sees wrong joiner name: ${nameB}`)
})

await check('joiner cannot act on the host\'s turn', async () => {
  if (await B.page.locator('[data-player="red"] .dice:not([disabled])').count()) throw new Error('joiner dice enabled on red turn')
  if (await B.page.locator('[data-token]:not([disabled])').count()) throw new Error('joiner tokens enabled on red turn')
})

await check('host forces 6 and unlocks a token; joiner sees the same move', async () => {
  await A.page.locator('[data-debug-toggle]').click()
  await A.page.locator('[data-force="6"]').click()
  await waitPhase(A.page, 'move')
  await A.page.locator('[data-token="red-2"]').click()
  await waitPos(A.page, 'red-2', 0)
  await waitPos(B.page, 'red-2', 0)
  await settled(B.page)
  await waitTurn(B.page, 'red')
})

await check('host forces 6 twice more: three sixes, turn passes to the joiner on both', async () => {
  await A.page.locator('[data-force="6"]').click()
  await waitPhase(A.page, 'move')
  await A.page.locator('[data-token="red-0"]').click()
  await waitPos(A.page, 'red-0', 0)
  await settled(A.page)
  await A.page.locator('[data-force="6"]').click()
  await waitTurn(A.page, 'yellow')
  await waitTurn(B.page, 'yellow')
  await settled(B.page)
})

await check('joiner taps its dice: intent reaches the host, result shows on both', async () => {
  await B.page.locator('[data-player="yellow"] .dice').click({ force: true })
  // Either yellow gets a 6 (then must move) or the turn goes back to red.
  await B.page.waitForFunction(() => {
    const a = document.querySelector('.app')
    return a?.dataset.busy === 'false' && (a?.dataset.phase === 'move' || a?.dataset.turn === 'red')
  }, null, { timeout: 10000 })
  if ((await B.page.locator('.app').getAttribute('data-phase')) === 'move') {
    const movable = await B.page.locator('[data-token^="yellow"]:not([disabled])').count()
    if (movable !== 4) throw new Error(`expected 4 movable on joiner, got ${movable}`)
    await B.page.locator('[data-token="yellow-1"]').click()
    await waitPos(B.page, 'yellow-1', 0)
    await waitPos(A.page, 'yellow-1', 0)
  }
  await settled(A.page)
  await settled(B.page)
  const ta = await A.page.locator('.app').getAttribute('data-turn')
  const tb = await B.page.locator('.app').getAttribute('data-turn')
  if (ta !== tb) throw new Error(`turn mismatch host=${ta} joiner=${tb}`)
})

await check('joiner reloads mid-game and rejoins with identical positions', async () => {
  const before = {}
  for (const id of ['red-0', 'red-2', 'yellow-1']) before[id] = await posOf(A.page, id)
  await B.page.reload({ waitUntil: 'networkidle' })
  await B.page.locator('[data-action="rejoin"]').click()
  await B.page.waitForSelector('.app[data-mode="join"]', { timeout: 8000 })
  for (const [id, pos] of Object.entries(before)) await waitPos(B.page, id, pos)
  await A.page.waitForFunction(() => document.querySelectorAll('[data-lobby-player]').length === 0 || true)
})

await check('room pill opens the lobby modal with both players connected', async () => {
  await A.page.locator('[data-room-pill]').click()
  await A.page.waitForSelector('[data-lobby]')
  const txt = await A.page.locator('[data-lobby]').innerText()
  if (!txt.includes(code) || !txt.includes('Kajal')) throw new Error(`modal text: ${txt}`)
})

await check('no console errors on either device', async () => {
  const all = [...A.errors, ...B.errors]
  if (all.length) throw new Error(all.join('\n'))
})

await A.page.screenshot({ path: '../docs/screenshots/lan-host.png' })
await B.page.screenshot({ path: '../docs/screenshots/lan-joiner.png' })
await browser.close()
stop()
console.log('lan check passed')
