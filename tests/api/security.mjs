import {
  BASE, ORIGIN, call, check, forgeJwt, group, imageForm, jwtClaims, newPhone, register,
} from './harness.mjs'

// The secret that used to be hard-coded as the default in application.properties and docker-compose.yml.
const OLD_PUBLIC_DEV_SECRET = 'dev-only-secret-change-me-0123456789abcdef'

const SEEN = (r) => r.status !== 401 && r.status !== 403

/** Endpoint table: who may call it. Bodies are invalid or point at missing ids, so nothing is changed. */
const ENDPOINTS = [
  // household
  { m: 'GET', p: '/home', who: ['household'] },
  { m: 'GET', p: '/listings/mine', who: ['household'] },
  { m: 'POST', p: '/listings', body: {}, who: ['household'] },
  { m: 'POST', p: '/scan', form: () => imageForm(undefined, { hint: 'NOPE' }), who: ['household'] },
  { m: 'GET', p: '/pools/mine', who: ['household'] },
  { m: 'POST', p: '/municipal-requests', body: {}, who: ['household'] },
  { m: 'GET', p: '/municipal-requests/mine', who: ['household'] },
  { m: 'GET', p: '/collection-points/nearby', who: ['household'] },
  { m: 'POST', p: '/ratings', body: { listingId: 999999, stars: 3 }, who: ['household'] },
  { m: 'GET', p: '/ratings/mine', who: ['household'] },
  // collectors
  { m: 'GET', p: '/collector/pools', who: ['dealer', 'compost'] },
  { m: 'GET', p: '/collector/profile', who: ['dealer', 'compost'] },
  { m: 'GET', p: '/collector/rate-card', who: ['dealer', 'compost'] },
  { m: 'GET', p: '/collector/pickups', who: ['dealer', 'compost'] },
  { m: 'GET', p: '/collector/earnings', who: ['dealer', 'compost'] },
  { m: 'GET', p: '/collector/rating', who: ['dealer', 'compost'] },
  { m: 'POST', p: '/pools/999999/accept', body: { start: '2099-01-01T10:00:00', end: '2099-01-01T11:00:00' }, who: ['dealer', 'compost'] },
  { m: 'GET', p: '/pickups/999999/route', who: ['dealer', 'compost'] },
  { m: 'POST', p: '/pickups/stops/999999/complete', body: { actualKg: 1, paymentMode: 'CASH' }, who: ['dealer', 'compost'] },
  // municipal
  { m: 'GET', p: '/municipal/overview', who: ['officer', 'commissioner'] },
  { m: 'GET', p: '/municipal/requests', who: ['officer', 'commissioner'] },
  { m: 'GET', p: '/municipal/staff', who: ['officer', 'commissioner'] },
  { m: 'GET', p: '/municipal/collection-points', who: ['officer', 'commissioner'] },
  { m: 'GET', p: '/municipal/collectors', who: ['officer', 'commissioner'] },
  // the commissioner does not handle requests: that is the ward officer's job
  { m: 'PUT', p: '/municipal/requests/999999', body: { status: 'REJECTED' }, who: ['officer'] },
  // municipal collection workers
  { m: 'GET', p: '/staff/tasks', who: ['staff'] },
  { m: 'POST', p: '/staff/tasks/999999/collected', who: ['staff'] },
]

/** Run this last: once the limit is reached this client cannot register anybody else for an hour. */
export async function registrationFlood() {
  group('Registration abuse')
  let blockedAt = 0
  for (let i = 1; i <= 120 && !blockedAt; i++) {
    const res = await call('POST', '/auth/register', {
      body: { phone: newPhone(), name: 'Flood', password: 'secret12', role: 'HOUSEHOLD' },
    })
    if (res.status === 429) blockedAt = i
  }
  check('creating accounts without end is throttled (429)', blockedAt > 0, 'a hundred and twenty accounts were created from one address')
}

export async function security(ctx) {
  group('Authentication and tokens')

  for (const path of ['/home', '/collector/pools', '/municipal/overview']) {
    const r = await call('GET', path)
    check(`no token -> 401 on ${path}`, r.status === 401, `got ${r.status}`)
  }
  let r = await call('GET', '/home', { token: 'abc.def.ghi' })
  check('garbage token -> 401', r.status === 401, `got ${r.status}`)

  const good = ctx.tokens.household
  const tampered = good.slice(0, -3) + (good.endsWith('AAA') ? 'BBB' : 'AAA')
  r = await call('GET', '/home', { token: tampered })
  check('token with a changed signature -> 401', r.status === 401, `got ${r.status}`)

  const claims = jwtClaims(good)
  const noneToken = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${good.split('.')[1]}.`
  r = await call('GET', '/home', { token: noneToken })
  check('alg=none token -> 401', r.status === 401, `got ${r.status}`)

  const forged = forgeJwt(OLD_PUBLIC_DEV_SECRET, { ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })
  r = await call('GET', '/home', { token: forged })
  check('token signed with the old public default secret is rejected', r.status === 401,
    `got ${r.status}: anyone who read the repository could forge a token for any user`)

  const forgedOfficer = forgeJwt(OLD_PUBLIC_DEV_SECRET, {
    ...claims, role: 'MUNICIPAL', exp: Math.floor(Date.now() / 1000) + 3600,
  })
  r = await call('GET', '/municipal/overview', { token: forgedOfficer })
  check('forged MUNICIPAL token (old default secret) is rejected', r.status === 401 || r.status === 403, `got ${r.status}`)

  if (process.env.JWT_SECRET) {
    const expired = forgeJwt(process.env.JWT_SECRET, { ...claims, exp: Math.floor(Date.now() / 1000) - 60 })
    r = await call('GET', '/home', { token: expired })
    check('expired token (correctly signed) -> 401', r.status === 401, `got ${r.status}`)
  } else {
    console.log('  skip  expired-token check needs JWT_SECRET in the environment')
  }

  group('Login behaviour')
  const unknown = await call('POST', '/auth/login', { body: { phone: '9000000998', password: 'whatever1' } })
  const wrong = await call('POST', '/auth/login', { body: { phone: '9000000001', password: 'whatever1' } })
  check('unknown phone and wrong password give the same answer (no user enumeration)',
    unknown.status === wrong.status && unknown.json?.error === wrong.json?.error,
    `unknown=${unknown.status} ${unknown.text} / wrong=${wrong.status} ${wrong.text}`)

  const victimPhone = newPhone()
  let locked = 0
  for (let i = 0; i < 15; i++) {
    const a = await call('POST', '/auth/login', { body: { phone: victimPhone, password: `bad-password-${i}` } })
    if (a.status === 429) locked += 1
  }
  check('repeated wrong passwords are throttled (429)', locked > 0, 'all 15 guesses were answered normally: passwords can be brute-forced')
  r = await call('POST', '/auth/login', { body: { phone: '9000000001', password: 'demo1234' } })
  check('throttling one phone does not lock other users out', r.status === 200, `got ${r.status}`)

  group('Registration validation')
  const fresh = () => ({ phone: newPhone(), name: 'QA', password: 'secret12', role: 'HOUSEHOLD' })
  let base = fresh()
  r = await call('POST', '/auth/register', { body: { ...base, password: '123' } })
  check('short password -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...base, phone: '12345' } })
  check('bad phone -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...base, role: 'MUNICIPAL' } })
  check('municipal self-registration -> 403', r.status === 403, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...base, role: 'FIELD_STAFF' } })
  check('collection-worker self-registration -> 403', r.status === 403, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...base, role: 'ADMIN' } })
  check('unknown role -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...fresh(), lat: 200, lng: 400 } })
  check('impossible coordinates -> 400 (not 500)', r.status === 400, `got ${r.status} ${r.text.slice(0, 120)}`)
  r = await call('POST', '/auth/register', { body: { ...fresh(), lat: 20.3 } })
  check('latitude without longitude -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...fresh(), name: 'x'.repeat(300) } })
  check('300 character name -> 400 (not 500)', r.status === 400, `got ${r.status} ${r.text.slice(0, 120)}`)
  base = fresh()
  r = await call('POST', '/auth/register', { body: { ...base, name: '<script>alert(1)</script> ; DROP TABLE users;--' } })
  check('markup and SQL in a name is stored as plain text', r.status === 200 && r.json.user.name.includes('<script>'), `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...base, name: 'Again' } })
  check('duplicate phone -> 409', r.status === 409, `got ${r.status}`)
  r = await call('POST', '/auth/register', { body: { ...fresh(), lat: 28.58, lng: 77.32 } })
  check('a user outside every ward is accepted with no ward', r.status === 200 && r.json.user.wardId === null, `got ${r.status} ward=${r.json?.user?.wardId}`)

  group('Authorization matrix (role x endpoint)')
  let wrongCount = 0
  const lines = []
  for (const e of ENDPOINTS) {
    for (const [role, token] of Object.entries(ctx.tokens)) {
      if (!['household', 'dealer', 'compost', 'officer', 'commissioner', 'staff'].includes(role)) continue
      const res = await call(e.m, e.p, { token, body: e.body, form: e.form?.() })
      const allowed = e.who.includes(role)
      const ok = allowed ? SEEN(res) : res.status === 403
      if (!ok) {
        wrongCount += 1
        lines.push(`${role} ${e.m} ${e.p} -> ${res.status} (${allowed ? 'should be allowed' : 'should be 403'})`)
      }
    }
  }
  check(`all ${ENDPOINTS.length * 6} role/endpoint combinations behave as designed`, wrongCount === 0, lines.join('\n          '))

  for (const e of ENDPOINTS) {
    const res = await call(e.m, e.p, { body: e.body, form: e.form?.() })
    if (res.status !== 401) {
      check(`anonymous call to ${e.m} ${e.p} -> 401`, false, `got ${res.status}`)
    }
  }
  check('every protected endpoint rejects anonymous calls', true)

  for (const p of ['/impact', '/catalog', '/scan/mode']) {
    r = await call('GET', p)
    check(`public endpoint ${p} is open`, r.status === 200, `got ${r.status}`)
  }

  group('Transport and error handling')
  r = await fetch(BASE + '/home', { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET' } })
  check('CORS preflight from the app origin is allowed', r.status === 200 || r.status === 204, `got ${r.status}`)
  r = await fetch(BASE + '/home', { method: 'OPTIONS', headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'GET' } })
  check('CORS preflight from another origin is refused', r.status === 403, `got ${r.status}`)

  r = await call('GET', '/definitely-not-a-route', { token: ctx.tokens.household })
  check('unknown route -> 404 without a stack trace', r.status === 404 && !/at com\.|Exception/.test(r.text), `got ${r.status} ${r.text.slice(0, 120)}`)
  r = await call('DELETE', '/home', { token: ctx.tokens.household })
  check('wrong method -> 405', r.status === 405, `got ${r.status}`)

  // nginx does not proxy /actuator, so ask the backend port directly
  const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'
  for (const p of ['env', 'beans', 'heapdump', 'mappings', 'health', 'metrics', 'prometheus']) {
    const act = await fetch(`${backend}/actuator/${p}`)
    check(`actuator/${p} is not exposed`, act.status === 404 || act.status === 401 || act.status === 403, `got ${act.status}`)
  }
  // Metrics live on a separate internal port that is not published; the public health check is a normal API route.
  const health = await fetch(`${backend}/api/v1/health`)
  check('/api/v1/health is open', health.status === 200, `got ${health.status}`)

  r = await fetch(ORIGIN + '/')
  const h = (n) => r.headers.get(n)
  check('frontend refuses to be framed (clickjacking)', Boolean(h('x-frame-options')) || /frame-ancestors/.test(h('content-security-policy') ?? ''),
    'no X-Frame-Options or CSP frame-ancestors header')
  check('frontend sends X-Content-Type-Options: nosniff', h('x-content-type-options') === 'nosniff', `got ${h('x-content-type-options')}`)
  check('frontend sends a Content-Security-Policy', Boolean(h('content-security-policy')), 'missing')
  // OpenStreetMap refuses tile requests without a Referer, so the policy must not strip it from cross-origin requests.
  check('the referrer policy still lets the map tile server see our site name', h('referrer-policy') === 'strict-origin-when-cross-origin', `got ${h('referrer-policy')}`)
  check('index.html is never cached', /no-store|no-cache/.test(h('cache-control') ?? ''), `got ${h('cache-control')}`)
}
