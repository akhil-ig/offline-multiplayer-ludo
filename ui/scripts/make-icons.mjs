// Renders the app icon SVG to the PNG sizes Tauri and the PWA need.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const out = process.argv[2] ?? '../tauri/icons'
mkdirSync(out, { recursive: true })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
    <radialGradient id="t" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#f7f1e3"/><stop offset="1" stop-color="#cfc2a6"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#14152b"/>
  <g transform="translate(56 56)">
    <rect width="200" height="200" fill="#e2383f"/>
    <rect x="200" width="200" height="200" fill="#1ea65a"/>
    <rect x="200" y="200" width="200" height="200" fill="#f5b800"/>
    <rect y="200" width="200" height="200" fill="#2b6fe6"/>
    <rect width="400" height="400" fill="url(#g)"/>
    <circle cx="200" cy="200" r="118" fill="url(#t)"/>
    <g transform="translate(200 200) rotate(-12)">
      <rect x="-62" y="-62" width="124" height="124" rx="26" fill="#fffdf7" stroke="#b9ad91" stroke-width="4"/>
      <g fill="#15162b"><circle cx="-32" cy="-32" r="11"/><circle cx="32" cy="-32" r="11"/><circle cx="0" cy="0" r="11"/><circle cx="-32" cy="32" r="11"/><circle cx="32" cy="32" r="11"/></g>
    </g>
  </g>
</svg>`
writeFileSync(`${out}/icon.svg`, svg)

const browser = await chromium.launch()
for (const [name, size] of [
  ['icon.png', 1024],
  ['128x128@2x.png', 256],
  ['128x128.png', 128],
  ['32x32.png', 32],
  ['../../ui/public/icons/icon-192.png', 192],
  ['../../ui/public/icons/icon-512.png', 512],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  await page.screenshot({ path: `${out}/${name}`, omitBackground: true })
  await page.close()
  console.log(`${name} ${size}px`)
}
await browser.close()
