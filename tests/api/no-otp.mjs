// The default setup (PHONE_VERIFICATION_REQUIRED=false): a new account can use the app at once, with no SMS code.
// Needs a backend started with that setting on :8083 (run-all.sh starts one next to the main stack).
import { check, group, imageForm, summary } from './harness.mjs'

const API = (process.env.NO_OTP_BACKEND_URL ?? 'http://localhost:8083') + '/api/v1'
const call = async (method, path, { token, body, form } = {}) => {
  const headers = { 'X-Forwarded-For': `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(API + path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) })
  const text = await res.text()
  return { status: res.status, json: (() => { try { return JSON.parse(text) } catch { return null } })(), text }
}

group('Registration without an SMS code')
const phone = `95${String(Date.now()).slice(-8)}`
const reg = await call('POST', '/auth/register', { body: { phone, name: 'No Otp', password: 'secret12', role: 'HOUSEHOLD', lat: 20.305481, lng: 85.797729 } })
check('registering works', reg.status === 200, reg.text)
check('the new account is already marked verified', reg.json?.user?.phoneVerified === true, reg.text)
const token = reg.json?.token

let r = await call('POST', '/scan', { token, form: imageForm() })
check('it can scan a photo at once (not blocked by PHONE_NOT_VERIFIED)', r.status !== 403, r.text)
r = await call('POST', '/listings', { token, body: { itemCode: 'NEWSPAPER', estKg: 3, mode: 'POOL' } })
check('it can create a listing at once', r.status === 200, r.text)
r = await call('POST', '/me/phone/send-code', { token })
check('asking for a code anyway is harmless', r.status === 200 && r.json?.sent === false, r.text)

const dealer = await call('POST', '/auth/register', { body: { phone: `95${String(Date.now() + 5).slice(-8)}`, name: 'No Otp Dealer', password: 'secret12', role: 'KABADIWALA' } })
check('a dealer is also verified at once (it still needs the officer approval to work)', dealer.json?.user?.phoneVerified === true, dealer.text)

process.exit(summary() ? 1 : 0)
