// Proves the abuse limits are shared between backend instances (Redis), not counted per instance.
// Needs a second backend started on the same compose network, for example:
//   docker compose run -d --no-deps --name avshesh-backend-2 -p 127.0.0.1:8082:8080 backend
//   SECOND_URL=http://localhost:8082 node tests/api/shared-limit.mjs
import { check, group, summary } from './harness.mjs'

const A = (process.env.DIRECT_URL ?? 'http://localhost:8080') + '/api/v1'
const B = (process.env.SECOND_URL ?? 'http://localhost:8082') + '/api/v1'
const login = (base, phone, ip) => fetch(base + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
  body: JSON.stringify({ phone, password: 'wrong-password' }),
}).then((r) => r.status)

group('Shared limits across two backend instances')
const phone = `97${String(Date.now()).slice(-8)}`
// The limit is 8 failed logins per (client address, phone) in 15 minutes. Spread them evenly over both instances.
const first = []
for (let i = 0; i < 8; i += 1) first.push(await login(i % 2 === 0 ? A : B, phone, '10.9.0.1'))
check('8 wrong passwords, 4 on each instance, are all answered 401', first.every((s) => s === 401), first.join(','))
const onB = await login(B, phone, '10.9.0.1')
const onA = await login(A, phone, '10.9.0.1')
check('the 9th attempt is blocked on instance B (it only saw 4 itself)', onB === 429, `got ${onB}`)
check('and on instance A', onA === 429, `got ${onA}`)
const otherPhone = await login(B, `97${String(Date.now()).slice(-8)}`, '10.9.0.1')
check('another phone number from the same client is not affected', otherPhone === 401, `got ${otherPhone}`)
// Counting per client address means a stranger cannot lock the real owner out of their own account.
const otherClient = await login(B, phone, '10.9.0.77')
check('the same phone number from another client address is not blocked', otherClient === 401, `got ${otherClient}`)

process.exit(summary() ? 1 : 0)
