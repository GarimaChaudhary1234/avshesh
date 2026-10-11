// Shared helpers for the browser tests. They drive a real Edge or Chrome against the running stack.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

export const APP = process.env.APP_URL ?? 'http://localhost:8088'
export const PASSWORD = 'demo1234'
const HERE = path.dirname(fileURLToPath(import.meta.url))
export const SHOTS = path.join(HERE, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

// 1x1 PNG, enough for the mock scanner (the user names the item).
export const PNG_PATH = path.join(SHOTS, 'item.png')
fs.writeFileSync(PNG_PATH, Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

export const DEMO = {
  household: { label: '🏠 Household', phone: '9000000001' },
  dealer: { label: '🛺 Scrap Dealer', phone: '9000000101' },
  compost: { label: '🌱 Compost', phone: '9000000102' },
  pending: { phone: '9000000103' },
  officer: { label: '🏛️ Ward Officer', phone: '9000000201' },
  // Not a demo login: the test run creates this officer through the commissioner's screen API (see ensureOtherOfficer).
  otherOfficer: { phone: '9000000202' },
  staff: { label: '🧹 Collection Worker', phone: '9000000301' },
  commissioner: { label: '🏛️ Commissioner', phone: '9000000200' },
}

/** Opens a browser page and collects every page error, console error and failed API call. */
export async function open({ viewport = { width: 420, height: 900 } } = {}) {
  const launchOptions = process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : { channel: process.env.BROWSER_CHANNEL ?? 'msedge' }
  const browser = await chromium.launch(launchOptions)
  const context = await browser.newContext({ viewport })
  // The tests must not depend on the public map servers: every map tile is answered with a blank image.
  await context.route('**/tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }))
  const page = await context.newPage()
  const problems = []
  // 4xx responses are expected in some tests; the test says so by calling allow(status, urlPart).
  const allowed = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !allowed.some((a) => m.text().includes(String(a.status)))) problems.push(`console: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/') && !allowed.some((a) => a.status === r.status() && r.url().includes(a.url))) {
      problems.push(`${r.status()} ${r.request().method()} ${r.url()}`)
    }
  })
  return {
    browser, context, page, problems,
    allow: (status, url = '') => allowed.push({ status, url }),
    close: () => browser.close(),
  }
}

export const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })

export async function loginWithButton(page, label) {
  await page.goto(`${APP}/login`)
  await page.getByRole('button', { name: label }).click()
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}

export async function loginWithPhone(page, phone, password = PASSWORD) {
  await page.goto(`${APP}/login`)
  await page.getByLabel('Phone number').fill(phone)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}

export async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click()
  await page.getByRole('heading', { name: 'Avshesh' }).waitFor()
}

export const nav = (page, name) => page.getByRole('navigation').getByRole('link', { name })

/** Scan with the mock scanner: pick the photo and name the item. */
export async function scanMock(page, itemLabel) {
  await nav(page, /Scan/).click()
  await page.locator('input[type=file]').setInputFiles(PNG_PATH)
  await page.locator('main').getByRole('combobox').selectOption({ label: itemLabel })
  await page.getByRole('button', { name: /Look up item/ }).click()
}

export function report(name, problems, steps) {
  console.log(`\n${name}`)
  steps.forEach((s) => console.log(`  ${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.ok || !s.detail ? '' : `\n          -> ${s.detail}`}`))
  const extra = [...new Set(problems)]
  extra.forEach((p) => console.log(`  PROBLEM  ${p}`))
  return steps.filter((s) => !s.ok).length + extra.length
}

/** Tiny runner: records a step as pass or fail instead of stopping at the first failure. */
export function stepper() {
  const steps = []
  return {
    steps,
    async step(name, fn) {
      try {
        await fn()
        steps.push({ name, ok: true })
      } catch (e) {
        steps.push({ name, ok: false, detail: String(e.message ?? e).split('\n')[0] })
      }
    },
  }
}

/** After registering, proves the phone number on the verify page (local test mode shows the code on screen). */
export async function verifyInBrowser(page) {
  await page.getByRole('heading', { name: 'Verify your phone number' }).waitFor()
  await page.getByRole('button', { name: 'Send code' }).click()
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)[0]
  await page.getByLabel('6-digit code').fill(code)
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await page.getByRole('link', { name: 'Continue' }).click()
}

/** An officer of a second ward, created through the API as the commissioner (the demo data has none). */
export async function ensureOtherOfficer() {
  const login = await fetch(`${APP}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: DEMO.commissioner.phone, password: PASSWORD }),
  })
  const { token } = await login.json()
  const res = await fetch(`${APP}/api/v1/municipal/officers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Other Ward Officer (test)', phone: DEMO.otherOfficer.phone, password: PASSWORD, wardId: 1 }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`could not create the second officer: ${res.status}`)
}
