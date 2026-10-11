// Renders public/favicon.svg to the PNG icons the install prompt needs. Run once after changing the logo:
//   node scripts/make-icons.mjs        (needs playwright-core, e.g. from ../tests/e2e/node_modules)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(join(here, '..', '..', 'tests', 'e2e', 'package.json'))('playwright-core')
const svg = readFileSync(join(here, '..', 'public', 'favicon.svg'), 'utf8')

const browser = await chromium.launch({ channel: 'msedge' })
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: join(here, '..', 'public', name), omitBackground: true })
  await page.close()
}
await browser.close()
console.log('icons written')
