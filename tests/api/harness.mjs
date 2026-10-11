// Minimal test harness for the HTTP API. No dependencies: Node 22 has fetch, FormData and crypto.
import crypto from 'node:crypto'

export const BASE = (process.env.BASE_URL ?? 'http://localhost:8088') + '/api/v1'
// The backend itself, reachable from the host. nginx overwrites X-Forwarded-For, so tests that need to
// pretend to be many different clients talk to this address instead.
export const DIRECT = (process.env.DIRECT_URL ?? 'http://localhost:8080') + '/api/v1'
let fakeIp = 0
export const nextIp = () => `10.${(Date.now() >> 8) & 255}.${(++fakeIp >> 8) & 255}.${fakeIp & 255}`
export const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:8088'
export const DEMO_PASSWORD = 'demo1234'

// Centre of the demo mohalla (ward 15, Bhubaneswar). New test users are placed around it.
export const BASE_LAT = 20.305481
export const BASE_LNG = 85.797729

const results = []
let currentGroup = ''

export function group(name) {
  currentGroup = name
  console.log(`\n== ${name}`)
}

/** Records one check. `ok` must be true when the system behaves the way we want. */
export function check(name, ok, detail = '') {
  results.push({ group: currentGroup, name, ok: Boolean(ok), detail })
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${ok || !detail ? '' : `\n          -> ${detail}`}`)
}

export function summary() {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('\nFAILED:')
    failed.forEach((f) => console.log(`  [${f.group}] ${f.name}${f.detail ? `\n      ${f.detail}` : ''}`))
  }
  return failed.length
}

export async function call(method, path, { token, body, form, headers = {}, raw, direct } = {}) {
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  let payload
  if (form) {
    payload = form
  } else if (raw !== undefined) {
    h['Content-Type'] = h['Content-Type'] ?? 'application/json'
    payload = raw
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const started = performance.now()
  const res = await fetch((direct ? DIRECT : BASE) + path, { method, headers: h, body: payload, redirect: 'manual' })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // not JSON
  }
  return { status: res.status, json, text, headers: res.headers, ms: performance.now() - started }
}

export async function login(phone, password = DEMO_PASSWORD) {
  const r = await call('POST', '/auth/login', { body: { phone, password } })
  if (r.status !== 200) throw new Error(`login ${phone} failed: ${r.status} ${r.text}`)
  return { token: r.json.token, user: r.json.user }
}

let phoneCounter = 0
const runPrefix = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
/** A fresh valid 10-digit number: 98 + a per-run prefix + a counter (room for 10,000 numbers per run). */
export function newPhone() {
  phoneCounter += 1
  return `98${runPrefix}${String(phoneCounter).padStart(4, '0')}`
}

/** Proves the phone number of a logged-in user. Needs the stack to return dev codes (local test mode). */
export async function verifyPhone(token) {
  const sent = await call('POST', '/me/phone/send-code', { token, direct: true, headers: { 'X-Forwarded-For': nextIp() } })
  if (sent.status !== 200 || !sent.json.devCode) throw new Error(`no dev code: ${sent.status} ${sent.text}`)
  const ok = await call('POST', '/me/phone/verify', { token, body: { code: sent.json.devCode } })
  if (ok.status !== 200) throw new Error(`verify failed: ${ok.status} ${ok.text}`)
  return ok.json
}

/**
 * Registers a throwaway user and returns { token, user, phone }.
 * New accounts must prove their phone before listing, scanning or accepting, so by default it is verified
 * here; pass { verify: false } to test the unverified state. `ip` fakes the client address (X-Forwarded-For,
 * only honoured when talking to the backend directly).
 */
export async function register(role, { lat = BASE_LAT, lng = BASE_LNG, name = 'Test User', verify = true, ip } = {}) {
  const phone = newPhone()
  const r = await call('POST', '/auth/register', {
    body: { phone, name, password: 'secret12', role, lat, lng },
    direct: true,
    headers: { 'X-Forwarded-For': ip ?? nextIp() },
  })
  if (r.status !== 200) throw new Error(`register ${role} failed: ${r.status} ${r.text}`)
  const user = verify ? await verifyPhone(r.json.token) : r.json.user
  return { token: r.json.token, user, phone }
}

// ---- JWT helpers for forging tokens in security tests
const b64 = (obj) => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url')

export function forgeJwt(secret, claims, header = { alg: 'HS256', typ: 'JWT' }) {
  const data = `${b64(header)}.${b64(claims)}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function jwtClaims(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
}

export function imageForm(bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), { type = 'image/png', name = 'item.png', hint } = {}) {
  const form = new FormData()
  form.append('photo', new Blob([bytes], { type }), name)
  if (hint) form.append('hint', hint)
  return form
}

/** Local time in India as the "yyyy-MM-ddTHH:mm:ss" string a browser date picker would send. */
export function istLocal(offsetHours = 0) {
  const d = new Date(Date.now() + offsetHours * 3600_000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
