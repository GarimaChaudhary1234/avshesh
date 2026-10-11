// Audits the figures of a running stack, in two layers:
//  1. scripts/audit.sql: rules the database itself must satisfy (every impact event comes from exactly one finished
//     stop, statuses agree with each other, payments and ratings are valid ...). Each rule must have 0 violations.
//  2. The numbers the API shows (public impact, every ward, the city, dealer earnings, household home screens, ward
//     overviews) are recomputed straight from the tables and must match.
// The stack must be up (docker compose) and the database reachable through `docker compose exec db psql`.
//   node tests/api/audit.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, check, group, summary } from './harness.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const psql = (sql) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'avshesh', '-d', 'avshesh', '-At', '-F', '|', '-f', '-'], {
    cwd: ROOT, input: sql, encoding: 'utf8',
  }).trim()
const rows = (sql) => {
  const out = psql(sql)
  return out ? out.split('\n').map((l) => l.split('|')) : []
}
const one = (sql) => rows(sql)[0] ?? []
const num = (x) => Number(x ?? 0)
const close = (a, b, tol = 0.011) => Math.abs(num(a) - num(b)) <= tol
const round2 = (n) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- 1. the rules of the database
group('Database rules (scripts/audit.sql)')
const rules = psql(fs.readFileSync(path.join(ROOT, 'scripts', 'audit.sql'), 'utf8')).split('\n').map((l) => l.split('|'))
for (const [rule, violations] of rules) {
  check(rule, num(violations) === 0, `${violations} violation(s)`)
}

// ---------------------------------------------------------------- 2. the API against the tables
const login = async (phone, passwords = ['demo1234', 'secret12']) => {
  for (const password of passwords) {
    const r = await call('POST', '/auth/login', { body: { phone, password }, direct: true, headers: { 'X-Forwarded-For': `10.66.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } })
    if (r.status === 200) return r.json.token
  }
  return null
}
const commissioner = await login('9000000200')
if (!commissioner) throw new Error('cannot log in as the commissioner (is the stack seeded?)')

group('Public impact equals the sum of the impact events')
const totals = one(`select coalesce(sum(kg_diverted),0), coalesce(sum(kg_diverted) filter (where category <> 'WET'),0),
  coalesce(sum(composted_kg),0), coalesce(sum(co2_saved_kg),0), coalesce(sum(paid_to_household),0), count(*),
  count(distinct coalesce(pickup_id, -id)) from impact_events`)
let r = await call('GET', '/impact')
check('kg diverted', close(r.json.kgDiverted, totals[0]), `${r.json.kgDiverted} vs ${totals[0]}`)
check('kg recycled', close(r.json.kgRecycled, totals[1]), `${r.json.kgRecycled} vs ${totals[1]}`)
check('compost made', close(r.json.kgComposted, totals[2]), `${r.json.kgComposted} vs ${totals[2]}`)
check('CO2', close(r.json.co2SavedKg, totals[3]), `${r.json.co2SavedKg} vs ${totals[3]}`)
check('paid to households', close(r.json.paidToHouseholds, totals[4]), `${r.json.paidToHouseholds} vs ${totals[4]}`)
check('homes collected from = number of finished stops', r.json.collections === num(totals[5]), `${r.json.collections} vs ${totals[5]}`)
check('pickups = number of different pickups (trips)', r.json.pickups === num(totals[6]), `${r.json.pickups} vs ${totals[6]}`)
check('a pickup never has fewer homes than 1, so trips <= collections', r.json.pickups <= r.json.collections, '')
const finishedStops = num(one('select count(*) from pickup_stops where done_at is not null')[0])
check('collections equals the finished stops of the whole database', r.json.collections === finishedStops, `${r.json.collections} vs ${finishedStops}`)
const finishedTrips = num(one('select count(distinct pickup_id) from pickup_stops where done_at is not null')[0])
check('pickups equals the pickups that have a finished stop', r.json.pickups === finishedTrips, `${r.json.pickups} vs ${finishedTrips}`)

group('Every ward row of the commissioner equals the tables')
r = await call('GET', '/municipal/wards', { token: commissioner })
const city = r.json
const perWard = Object.fromEntries(rows(`select ward_id, sum(kg_diverted), count(*), count(distinct coalesce(pickup_id, -id)), sum(paid_to_household) from impact_events where ward_id is not null group by ward_id`).map((x) => [x[0], x]))
const households = Object.fromEntries(rows(`select ward_id, count(*) from users where role = 'HOUSEHOLD' and ward_id is not null group by ward_id`).map((x) => [x[0], num(x[1])]))
const dealers = rows(`select u.ward_id, c.verification_status, count(*) from users u join collectors c on c.user_id = u.id where u.ward_id is not null group by u.ward_id, c.verification_status`)
const openRequests = Object.fromEntries(rows(`select ward_id, count(*) from municipal_requests where status = 'OPEN' and ward_id is not null group by ward_id`).map((x) => [x[0], num(x[1])]))
const disputes = Object.fromEntries(rows(`select u.ward_id, count(*) from pickup_stops s join listings l on l.id = s.listing_id join users u on u.id = l.owner_id where s.payment_status = 'DISPUTED' and u.ward_id is not null group by u.ward_id`).map((x) => [x[0], num(x[1])]))
let bad = []
for (const w of city.wards) {
  const id = String(w.ward.id)
  const e = perWard[id]
  const d = (st) => num(dealers.find((x) => x[0] === id && x[1] === st)?.[2])
  const expect = {
    kgDiverted: num(e?.[1]), collections: num(e?.[2]), pickups: num(e?.[3]), registeredHouseholds: households[id] ?? 0,
    verifiedDealers: d('VERIFIED'), pendingDealers: d('PENDING'), dealers: d('VERIFIED') + d('PENDING') + d('REJECTED'),
    openRequests: openRequests[id] ?? 0, openDisputes: disputes[id] ?? 0,
  }
  for (const [key, want] of Object.entries(expect)) {
    if (!close(w[key], want)) bad.push(`ward ${id} ${key}: API ${w[key]} vs tables ${want}`)
  }
}
check(`all ${city.wards.length} wards: kg, collections, pickups, households, dealers, waiting requests, disputes`, bad.length === 0, bad.slice(0, 5).join(' | '))
const nullWard = one(`select coalesce(sum(kg_diverted),0), count(*) from impact_events where ward_id is null`)
const sumKg = city.wards.reduce((a, w) => a + w.kgDiverted, 0)
check('the wards add up to the city (plus waste from homes outside every ward)', close(sumKg + num(nullWard[0]), city.summary.impact.kgDiverted, 0.02), `${sumKg} + ${nullWard[0]} vs ${city.summary.impact.kgDiverted}`)
check('city households = sum of the wards = the household accounts that have a ward', city.summary.registeredHouseholds === Object.values(households).reduce((a, b) => a + b, 0), `${city.summary.registeredHouseholds}`)
check('city: open requests and disputes are the sums of the wards', city.summary.openRequests === Object.values(openRequests).reduce((a, b) => a + b, 0) && city.summary.openDisputes === Object.values(disputes).reduce((a, b) => a + b, 0), JSON.stringify(city.summary))

group('The share kept out of the dump follows its formula')
bad = []
const wardEvents = Object.fromEntries(rows(`select e.ward_id, (current_date - min(e.created_at)::date) + 1, max(w.population) from impact_events e join wards w on w.id = e.ward_id group by e.ward_id`).map((x) => [x[0], x]))
for (const w of city.wards) {
  const ev = wardEvents[String(w.ward.id)]
  if (!ev) continue
  const est = round2(num(ev[2]) * 0.45 * num(ev[1]))
  const pct = Math.round(Math.min(100, (w.kgDiverted / est) * 100) * 10) / 10
  if (w.keptFromDumpPercent === null || Math.abs(w.keptFromDumpPercent - pct) > 0.11) bad.push(`ward ${w.ward.id}: ${w.keptFromDumpPercent}% vs ${pct}% (kept ${w.kgDiverted} / estimate ${est})`)
}
check('ward share = kg / (population x 0.45 kg x days since its first pickup)', bad.length === 0, bad.slice(0, 4).join(' | '))
const cityPopulation = rows(`select distinct e.ward_id, w.population from impact_events e join wards w on w.id = e.ward_id`).reduce((a, x) => a + num(x[1]), 0)
const cityDays = num(one(`select (current_date - min(created_at)::date) + 1 from impact_events`)[0])
const cityEstimate = round2(cityPopulation * 0.45 * cityDays)
check('city estimate = population of the wards with pickups x 0.45 x days', close(city.summary.impact.estimatedWasteKg, cityEstimate, 0.5), `${city.summary.impact.estimatedWasteKg} vs ${cityEstimate}`)

group('Dealer earnings and household home screens equal the finished stops')
const collectors = rows(`select u.phone, u.id, u.role from users u where u.role in ('KABADIWALA', 'COMPOST') order by u.id`)
let checkedDealers = 0
bad = []
for (const [phone, id, role] of collectors) {
  const token = await login(phone)
  if (!token) continue
  checkedDealers++
  const e = (await call('GET', '/collector/earnings?days=365', { token })).json
  const t = one(`select coalesce(sum(s.actual_kg),0), coalesce(sum(s.amount_paid),0), coalesce(sum(s.profit),0), count(distinct s.pickup_id)
                   from pickup_stops s join pickups p on p.id = s.pickup_id where p.collector_id = ${id} and s.done_at is not null`)
  const wantCompost = role === 'COMPOST' ? round2(num(t[0]) * 0.25) : 0
  if (!close(e.kg, t[0]) || !close(e.paidToHouseholds, t[1]) || !close(e.profit, t[2]) || e.pickups !== num(t[3]) || !close(e.compostKg, wantCompost)) {
    bad.push(`${phone}: API kg ${e.kg} paid ${e.paidToHouseholds} profit ${e.profit} pickups ${e.pickups} compost ${e.compostKg} vs tables ${t.join('/')} compost ${wantCompost}`)
  }
}
check(`${checkedDealers} dealer/compost accounts: kg, paid, profit, pickups, compost match their finished stops`, bad.length === 0 && checkedDealers > 0, bad.slice(0, 3).join(' | ') || 'no dealer could be logged in')

const homesList = rows(`select u.phone, u.id from users u where u.role = 'HOUSEHOLD' order by u.id`)
let checkedHomes = 0
bad = []
for (const [phone, id] of homesList) {
  const token = await login(phone)
  if (!token) continue
  checkedHomes++
  const h = (await call('GET', '/home', { token })).json
  const t = one(`select coalesce(sum(s.amount_paid),0), coalesce(sum(s.actual_kg),0), coalesce(sum(e.co2_saved_kg),0)
                   from pickup_stops s join listings l on l.id = s.listing_id left join impact_events e on e.stop_id = s.id
                  where l.owner_id = ${id} and s.done_at is not null and date_trunc('month', s.done_at) = date_trunc('month', now())`)
  const pct = h.estimatedWasteKg > 0 ? Math.round(Math.min(100, (h.kgSaved / h.estimatedWasteKg) * 100) * 10) / 10 : 0
  if (!close(h.earnedThisMonth, t[0]) || !close(h.kgSaved, t[1]) || !close(h.co2SavedKg, t[2]) || Math.abs(h.keptFromDumpPercent - pct) > 0.11) {
    bad.push(`${phone}: API earned ${h.earnedThisMonth} kg ${h.kgSaved} co2 ${h.co2SavedKg} ${h.keptFromDumpPercent}% vs tables ${t.join('/')} ${pct}%`)
  }
}
check(`${checkedHomes} households: earned, kg, CO2 this month and the share match their finished stops`, bad.length === 0 && checkedHomes > 0, bad.slice(0, 3).join(' | ') || 'no household could be logged in')

group('A ward officer\'s overview equals the tables')
const officers = rows(`select u.phone, u.ward_id from users u where u.role = 'MUNICIPAL' and u.ward_id is not null order by u.id`)
bad = []
let checkedOfficers = 0
for (const [phone, ward] of officers) {
  const token = await login(phone)
  if (!token) continue
  checkedOfficers++
  const o = (await call('GET', '/municipal/overview', { token })).json
  const e = one(`select coalesce(sum(kg_diverted),0), count(*), count(distinct coalesce(pickup_id, -id)), coalesce(sum(paid_to_household),0) from impact_events where ward_id = ${ward}`)
  const pools = Object.fromEntries(rows(`select status, count(*) from pools where ward_id = ${ward} group by status`).map((x) => [x[0], num(x[1])]))
  const pending = num(one(`select count(*) from users u join collectors c on c.user_id = u.id where u.ward_id = ${ward} and c.verification_status = 'PENDING'`)[0])
  const verified = num(one(`select count(*) from users u join collectors c on c.user_id = u.id where u.ward_id = ${ward} and c.verification_status = 'VERIFIED'`)[0])
  const points = num(one(`select count(*) from collection_points where ward_id = ${ward} and active`)[0])
  if (!close(o.impact.kgDiverted, e[0]) || o.impact.collections !== num(e[1]) || o.impact.pickups !== num(e[2]) || !close(o.impact.paidToHouseholds, e[3])
    || o.households !== (households[ward] ?? 0) || o.pendingCollectors !== pending || o.verifiedCollectors !== verified
    || o.openRequests !== (openRequests[ward] ?? 0) || o.openDisputes !== (disputes[ward] ?? 0) || o.openedCollectionPoints !== points
    || ['FILLING', 'READY', 'ACCEPTED', 'DONE'].some((s) => (o.poolsByStatus[s] ?? 0) !== (pools[s] ?? 0))) {
    bad.push(`${phone} (ward ${ward}): ${JSON.stringify({ impact: o.impact, h: o.households, v: o.verifiedCollectors, p: o.pendingCollectors, r: o.openRequests, d: o.openDisputes, pools: o.poolsByStatus })}`)
  }
}
check(`${checkedOfficers} ward officers: impact, households, dealers, waiting requests, disputes, drop-off points and pools match`, bad.length === 0 && checkedOfficers > 0, bad.slice(0, 2).join(' | ') || 'no officer could be logged in')

process.exit(summary() ? 1 : 0)
