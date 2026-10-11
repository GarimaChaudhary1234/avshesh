// Runs every API check against a running, freshly seeded stack (mock scanner):
//   docker compose down -v && SCANNER=mock docker compose up -d && node tests/api/run.mjs
// Set JWT_SECRET to the secret the backend uses to also check expired-token handling.
import { business } from './business.mjs'
import { input } from './input.mjs'
import { phase2 } from './phase2.mjs'
import { hierarchy } from './hierarchy.mjs'
import { staff } from './staff.mjs'
import { registrationFlood, security } from './security.mjs'
import { call, login, summary } from './harness.mjs'

const ctx = { tokens: {} }
const accounts = {
  household: '9000000001', dealer: '9000000101', compost: '9000000102', pending: '9000000103',
  officer: '9000000201', commissioner: '9000000200', staff: '9000000301',
}
for (const [role, phone] of Object.entries(accounts)) {
  ctx.tokens[role] = (await login(phone)).token
}

// An officer of a second ward, to check that officers cannot see each other's wards. The demo data has none on purpose:
// the commissioner creates this one, which also exercises that feature.
const created = await call('POST', '/municipal/officers', {
  token: ctx.tokens.commissioner,
  body: { name: 'Other Ward Officer (test)', phone: '9000000202', password: 'demo1234', wardId: 1 },
})
if (created.status !== 200) throw new Error(`could not create the second officer: ${created.status} ${created.text}`)
ctx.tokens.otherOfficer = (await login('9000000202')).token

// business first: it expects the untouched demo data
await business(ctx)
await security(ctx)
await input(ctx)
await phase2(ctx)
await hierarchy(ctx)
await staff(ctx)
await registrationFlood()

process.exit(summary() ? 1 : 0)
