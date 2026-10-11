// Rough load check: how do the main screens behave with a realistic amount of data?
//   docker compose down -v && SCANNER=mock docker compose up -d && node tests/api/load.mjs
// It is not part of run-all.sh because it makes hundreds of users and takes a while.
import { BASE_LAT, BASE_LNG, call, login, register } from './harness.mjs'

// Needs REGISTER_LIMIT_PER_HOUR=1000 on the backend: this makes more accounts than the normal limit allows.
const HOUSEHOLDS = Number(process.env.HOUSEHOLDS ?? 80)
const DEALERS = Number(process.env.DEALERS ?? 12)
const LISTINGS_EACH = 3
const ITEMS = ['PET_BOTTLE', 'NEWSPAPER', 'CARDBOARD']

const rand = (a, b) => a + Math.random() * (b - a)
const pct = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const fmt = (ms) => `${ms.toFixed(0)} ms`

async function timed(label, fn, times = 15) {
  const samples = []
  for (let i = 0; i < times; i++) samples.push((await fn()).ms)
  console.log(`  ${label.padEnd(46)} median ${fmt(pct(samples, 0.5)).padStart(8)}   p95 ${fmt(pct(samples, 0.95)).padStart(8)}`)
}

async function parallel(label, n, fn) {
  const started = performance.now()
  const results = await Promise.all(Array.from({ length: n }, (_, i) => fn(i)))
  const wall = performance.now() - started
  const slowest = Math.max(...results.map((r) => r.ms))
  const failed = results.filter((r) => r.status >= 500).length
  console.log(`  ${label.padEnd(46)} ${n} at once: wall ${fmt(wall).padStart(8)}   slowest ${fmt(slowest).padStart(8)}   server errors ${failed}`)
}

console.log(`Creating ${HOUSEHOLDS} households with ${LISTINGS_EACH} listings each, and ${DEALERS} dealers...`)
const officer = (await login('9000000201')).token
const started = performance.now()

const dealers = []
for (let i = 0; i < DEALERS; i++) {
  const d = await register('KABADIWALA', { name: `Load Dealer ${i}`, lat: BASE_LAT + rand(-0.02, 0.02), lng: BASE_LNG + rand(-0.02, 0.02) })
  await call('PUT', '/collector/profile', { token: d.token, body: { businessName: `Load Scrap ${i}`, vehicleType: 'E_RICKSHAW', costPerKm: 6 + (i % 5), acceptingPickups: true } })
  await call('PUT', '/collector/rate-card', {
    token: d.token,
    body: { serviceRadiusKm: 6, minTripProfit: 100 + i * 10, minLoadKg: 0, items: [
      { itemCode: 'PET_BOTTLE', buyRate: 11 + (i % 3), sellRate: 18 }, { itemCode: 'NEWSPAPER', buyRate: 13, sellRate: 19 },
      { itemCode: 'CARDBOARD', buyRate: 7, sellRate: 10 }] },
  })
  await call('POST', `/municipal/collectors/${d.user.id}/verification`, { token: officer, body: { status: 'VERIFIED' } })
  dealers.push(d)
}

const households = []
for (let i = 0; i < HOUSEHOLDS; i++) {
  const h = await register('HOUSEHOLD', { name: `Load Home ${i}`, lat: BASE_LAT + rand(-0.012, 0.012), lng: BASE_LNG + rand(-0.012, 0.012) })
  households.push(h)
}
await Promise.all(households.map(async (h) => {
  for (let k = 0; k < LISTINGS_EACH; k++) {
    await call('POST', '/listings', { token: h.token, body: { itemCode: ITEMS[k % 3], estKg: Math.round(rand(2, 15)), mode: 'POOL' } })
  }
}))
console.log(`  setup took ${((performance.now() - started) / 1000).toFixed(0)} s`)

const pools = (await call('GET', '/collector/pools', { token: dealers[0].token })).json
const ready = pools.filter((p) => p.ready).length
console.log(`  open pools visible to one dealer: ${pools.length} (${ready} ready)`)

// a household that has many listings of its own
const heavy = await register('HOUSEHOLD', { name: 'Load Heavy' })
for (let i = 0; i < 40; i++) await call('POST', '/listings', { token: heavy.token, body: { itemCode: ITEMS[i % 3], estKg: 3, mode: 'POOL' } })

console.log('\nOne request at a time')
await timed('household home', () => call('GET', '/home', { token: households[0].token }))
await timed('household pool card', () => call('GET', '/pools/mine', { token: households[0].token }))
await timed('household with 40 listings: My Listings', () => call('GET', '/listings/mine', { token: heavy.token }))
await timed(`dealer dashboard (${pools.length} pools)`, () => call('GET', '/collector/pools', { token: dealers[3].token }))
await timed('municipal overview', () => call('GET', '/municipal/overview', { token: officer }))
await timed(`municipal dealers (${DEALERS + 3})`, () => call('GET', '/municipal/collectors', { token: officer }))
await timed('municipal requests', () => call('GET', '/municipal/requests', { token: officer }))
await timed('public impact', () => call('GET', '/impact'))

console.log('\nMany at once')
await parallel('dealer dashboards', 25, (i) => call('GET', '/collector/pools', { token: dealers[i % dealers.length].token }))
await parallel('household homes', 40, (i) => call('GET', '/home', { token: households[i % households.length].token }))
await parallel('new listings', 30, (i) => call('POST', '/listings', { token: households[i % households.length].token, body: { itemCode: 'PET_BOTTLE', estKg: 2, mode: 'POOL' } }))
await parallel('logins (password hashing)', 20, () => call('POST', '/auth/login', { body: { phone: '9000000001', password: 'demo1234' } }))
