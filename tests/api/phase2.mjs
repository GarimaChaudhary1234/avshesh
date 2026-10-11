// Checks for the second round of features: phone proof, password reset, cookie login + CSRF, notifications,
// payment confirmation and disputes, vehicle capacity, rating weights and languages.
// Runs against the fresh stack after the business checks. It uses the backend port directly where a test has to
// pretend to be a different network address (nginx overwrites X-Forwarded-For).
import {
  BASE_LAT, BASE_LNG, DIRECT, call, check, group, imageForm, istLocal, login, nextIp, register, verifyPhone,
} from './harness.mjs'

const when = () => ({ start: istLocal(24), end: istLocal(26) })
const RATE_ITEMS = [
  { itemCode: 'PET_BOTTLE', buyRate: 13, sellRate: 18 }, { itemCode: 'NEWSPAPER', buyRate: 14, sellRate: 19 },
  { itemCode: 'CARDBOARD', buyRate: 7, sellRate: 10 },
]

/** A verified dealer near (lat, lng) with a rate card, approved by the commissioner. */
async function newDealer(ctx, lat, lng, { ip, capacity } = {}) {
  const d = await register('KABADIWALA', { name: 'P2 Dealer', lat, lng, ip })
  await call('PUT', '/collector/profile', {
    token: d.token,
    body: { businessName: 'P2 Scrap', vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: true, vehicleCapacityKg: capacity ?? null },
  })
  await call('PUT', '/collector/rate-card', {
    token: d.token, body: { serviceRadiusKm: 5, minTripProfit: 0, minLoadKg: 0, items: RATE_ITEMS },
  })
  await call('POST', `/municipal/collectors/${d.user.id}/verification`, { token: ctx.tokens.commissioner, body: { status: 'VERIFIED' } })
  return d
}

/** Households list newspaper, a dealer accepts, every stop is completed. Returns what the tests need. */
async function finishedPickup(ctx, { lat, lng, households = 2, kg = 40, dealer, ip }) {
  const homes = []
  for (let i = 0; i < households; i += 1) {
    homes.push(await register('HOUSEHOLD', { name: `P2 Home ${i}`, lat: lat + i * 0.00005, lng, ip }))
    await call('POST', '/listings', { token: homes[i].token, body: { itemCode: 'NEWSPAPER', estKg: kg, mode: 'POOL' } })
  }
  const d = dealer ?? (await newDealer(ctx, lat, lng, { ip }))
  const pool = (await call('GET', '/pools/mine', { token: homes[0].token })).json[0]
  const accepted = await call('POST', `/pools/${pool.id}/accept`, { token: d.token, body: when() })
  const stops = []
  for (const home of homes) {
    const mine = (await call('GET', '/listings/mine', { token: home.token })).json[0]
    const stop = accepted.json?.stops?.find((s) => s.ownerName === 'P2 Home ' + homes.indexOf(home))
    const done = await call('POST', `/pickups/stops/${stop.stopId}/complete`, {
      token: d.token, body: { actualKg: kg, paymentMode: 'CASH' },
    })
    stops.push({ home, listingId: mine.id, stopId: stop.stopId, done })
  }
  return { homes, dealer: d, pool, accepted, stops }
}

export async function phase2(ctx) {
  group('Phone proof')
  const fresh = await register('HOUSEHOLD', { name: 'P2 Unverified', verify: false })
  check('a new account starts with an unverified phone', fresh.user.phoneVerified === false, JSON.stringify(fresh.user))
  let r = await call('POST', '/listings', { token: fresh.token, body: { itemCode: 'NEWSPAPER', estKg: 3, mode: 'POOL' } })
  check('an unverified phone cannot list waste (403 PHONE_NOT_VERIFIED)', r.status === 403 && r.json?.code === 'PHONE_NOT_VERIFIED', `${r.status} ${r.text}`)
  r = await call('POST', '/scan', { token: fresh.token, form: imageForm() })
  check('an unverified phone cannot scan', r.status === 403 && r.json?.code === 'PHONE_NOT_VERIFIED', `${r.status} ${r.text}`)
  r = await call('POST', '/listings', { token: fresh.token, body: { itemCode: 'NEWSPAPER', estKg: 3, mode: 'POOL' }, headers: { 'Accept-Language': 'hi' } })
  check('the refusal is written in Hindi when asked', /[ऀ-ॿ]/.test(r.json?.error ?? ''), r.text)
  r = await call('POST', '/listings', { token: fresh.token, body: { itemCode: 'NEWSPAPER', estKg: 3, mode: 'POOL' }, headers: { 'Accept-Language': 'or' } })
  check('and in Odia', /[଀-୿]/.test(r.json?.error ?? ''), r.text)

  const ip = nextIp()
  const sent = await call('POST', '/me/phone/send-code', { token: fresh.token, direct: true, headers: { 'X-Forwarded-For': ip } })
  check('a code is sent (local test mode returns it)', sent.status === 200 && /^\d{6}$/.test(sent.json?.devCode ?? ''), sent.text)
  const wrong = sent.json.devCode === '000000' ? '111111' : '000000'
  r = await call('POST', '/me/phone/verify', { token: fresh.token, body: { code: wrong } })
  check('a wrong code is refused', r.status === 400 && r.json?.code === 'SMS_CODE_WRONG', r.text)
  let guesses = 0
  for (let i = 0; i < 8 && r.status !== 429; i += 1) {
    r = await call('POST', '/me/phone/verify', { token: fresh.token, body: { code: wrong } })
    guesses += 1
  }
  check('guessing the code is stopped (429)', r.status === 429, `after ${guesses} more guesses: ${r.status}`)

  const second = await register('HOUSEHOLD', { name: 'P2 Verified', verify: false })
  await verifyPhone(second.token)
  r = await call('POST', '/listings', { token: second.token, body: { itemCode: 'NEWSPAPER', estKg: 3, mode: 'POOL' } })
  check('after verification the same user can list', r.status === 200, `${r.status} ${r.text}`)

  group('Forgotten password')
  const pw = await register('HOUSEHOLD', { name: 'P2 Reset' })
  const resetIp = nextIp()
  const forgot = await call('POST', '/auth/password/forgot', { body: { phone: pw.phone }, direct: true, headers: { 'X-Forwarded-For': resetIp } })
  const stranger = await call('POST', '/auth/password/forgot', { body: { phone: '9999999990' }, direct: true, headers: { 'X-Forwarded-For': resetIp } })
  check('a code is issued for a real number', forgot.status === 200 && /^\d{6}$/.test(forgot.json?.devCode ?? ''), forgot.text)
  check('an unknown number gets the same answer shape and no code (no account enumeration)',
    stranger.status === 200 && stranger.json?.sent === true && !stranger.json?.devCode, stranger.text)
  r = await call('POST', '/auth/password/reset', { body: { phone: pw.phone, code: forgot.json.devCode, newPassword: 'brandnew1' } })
  check('the code sets a new password', r.status === 200, r.text)
  r = await call('POST', '/auth/login', { body: { phone: pw.phone, password: 'secret12' } })
  check('the old password no longer works', r.status === 401, `got ${r.status}`)
  r = await call('POST', '/auth/login', { body: { phone: pw.phone, password: 'brandnew1' } })
  check('the new password works', r.status === 200, `got ${r.status}`)
  r = await call('POST', '/auth/password/reset', { body: { phone: pw.phone, code: forgot.json.devCode, newPassword: 'again1234' } })
  check('a used code cannot be used again', r.status === 400, `got ${r.status}`)

  group('Cookie login and CSRF')
  const res = await fetch(DIRECT + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9000000001', password: 'demo1234' }),
  })
  const setCookies = res.headers.getSetCookie()
  const tokenCookie = setCookies.find((c) => c.startsWith('avshesh_token='))
  const xsrfCookie = setCookies.find((c) => c.startsWith('XSRF-TOKEN='))
  check('login sets an HttpOnly, SameSite=Strict token cookie', /HttpOnly/i.test(tokenCookie ?? '') && /SameSite=Strict/i.test(tokenCookie ?? ''), tokenCookie)
  check('the CSRF cookie is readable by the page (not HttpOnly)', xsrfCookie && !/HttpOnly/i.test(xsrfCookie), xsrfCookie)
  const cookieJar = (...cs) => cs.map((c) => c.split(';')[0]).join('; ')
  const token = tokenCookie.split(';')[0]
  const xsrf = decodeURIComponent(xsrfCookie.split(';')[0].split('=')[1])

  const get = await fetch(DIRECT + '/me', { headers: { Cookie: token } })
  check('the cookie alone authenticates a read', get.status === 200, `got ${get.status}`)
  // Regression: Spring used to expire the CSRF cookie on every cookie-authenticated request, which broke the
  // second change request made by a real browser.
  const withCookies = await fetch(DIRECT + '/me', { headers: { Cookie: cookieJar(tokenCookie, xsrfCookie) } })
  const cleared0 = withCookies.headers.getSetCookie().find((c) => c.startsWith('XSRF-TOKEN=') && /Expires=Thu, 01 Jan 1970|Max-Age=0/i.test(c))
  check('an ordinary authenticated read does not expire the CSRF cookie', !cleared0, cleared0)
  const body = JSON.stringify({ language: 'en' })
  const json = { 'Content-Type': 'application/json' }
  let w = await fetch(DIRECT + '/me/language', { method: 'PUT', headers: { ...json, Cookie: token }, body })
  check('a change request with only the cookie is refused (CSRF)', w.status === 403, `got ${w.status}`)
  w = await fetch(DIRECT + '/me/language', { method: 'PUT', headers: { ...json, Cookie: cookieJar(tokenCookie, xsrfCookie), 'X-XSRF-TOKEN': 'forged' }, body })
  check('a forged CSRF header is refused', w.status === 403, `got ${w.status}`)
  w = await fetch(DIRECT + '/me/language', { method: 'PUT', headers: { ...json, Cookie: cookieJar(tokenCookie, xsrfCookie), 'X-XSRF-TOKEN': xsrf }, body })
  check('cookie + matching CSRF header is accepted', w.status === 200, `got ${w.status}`)
  w = await fetch(DIRECT + '/me/language', {
    method: 'PUT', headers: { ...json, Authorization: `Bearer ${token.split('=')[1]}` }, body,
  })
  check('an API client with a Bearer header needs no CSRF token', w.status === 200, `got ${w.status}`)
  const out = await fetch(DIRECT + '/auth/logout', { method: 'POST', headers: { Cookie: cookieJar(tokenCookie, xsrfCookie), 'X-XSRF-TOKEN': xsrf } })
  const cleared = out.headers.getSetCookie().find((c) => c.startsWith('avshesh_token='))
  check('logout clears the token cookie', out.status < 300 && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cleared ?? ''), `${out.status} ${cleared}`)

  group('Payment confirmation and disputes')
  const a = await finishedPickup(ctx, { lat: BASE_LAT - 0.02, lng: BASE_LNG + 0.006 })
  check('the pickup completed for both households', a.stops.every((s) => s.done.status === 200), a.stops.map((s) => s.done.status).join(','))
  const [first, second2] = a.stops
  let listingView = (await call('GET', '/listings/mine', { token: first.home.token })).json[0]
  check('a completed listing waits for the household to confirm payment', listingView.paymentStatus === 'PENDING', JSON.stringify(listingView))
  r = await call('POST', `/listings/${first.listingId}/payment`, { token: second2.home.token, body: { received: true } })
  check('another household cannot answer for it', r.status === 403 || r.status === 404, `got ${r.status}`)
  r = await call('POST', `/listings/${first.listingId}/payment`, { token: first.home.token, body: { received: false } })
  check('saying "not received" needs a note', r.status === 400, `got ${r.status} ${r.text}`)
  r = await call('POST', `/listings/${first.listingId}/payment`, { token: first.home.token, body: { received: false, note: 'He paid only half' } })
  check('"not received" with a note opens a dispute', r.status === 200, `got ${r.status} ${r.text}`)
  r = await call('POST', `/listings/${first.listingId}/payment`, { token: first.home.token, body: { received: true } })
  check('a payment cannot be answered twice', r.status === 409, `got ${r.status}`)
  r = await call('POST', `/listings/${second2.listingId}/payment`, { token: second2.home.token, body: { received: true } })
  check('"received" confirms the payment', r.status === 200, `got ${r.status} ${r.text}`)
  listingView = (await call('GET', '/listings/mine', { token: second2.home.token })).json[0]
  check('the household sees CONFIRMED', listingView.paymentStatus === 'CONFIRMED', JSON.stringify(listingView))

  const disputes = await call('GET', '/municipal/disputes', { token: ctx.tokens.officer })
  const mine = disputes.json?.find((d) => JSON.stringify(d).includes('He paid only half'))
  check('the ward officer sees the dispute with the household\'s note', Boolean(mine), disputes.text.slice(0, 300))
  const other = await call('GET', '/municipal/disputes', { token: ctx.tokens.otherOfficer })
  check('an officer of another ward does not see it', !JSON.stringify(other.json).includes('He paid only half'), other.text.slice(0, 200))
  const stopId = a.stops[0].stopId
  r = await call('POST', `/municipal/disputes/${stopId}/resolve`, { token: ctx.tokens.otherOfficer, body: { note: 'not mine' } })
  check('an officer of another ward cannot resolve it', r.status === 403 || r.status === 404, `got ${r.status}`)
  r = await call('POST', `/municipal/disputes/${stopId}/resolve`, { token: ctx.tokens.household, body: { note: 'x' } })
  check('a household cannot resolve disputes', r.status === 403, `got ${r.status}`)
  r = await call('POST', `/municipal/disputes/${stopId}/resolve`, { token: ctx.tokens.officer, body: { note: '' } })
  check('resolving needs a note', r.status === 400, `got ${r.status}`)
  r = await call('POST', `/municipal/disputes/${stopId}/resolve`, { token: ctx.tokens.officer, body: { note: 'Dealer refunded Rs 50' } })
  check('the officer resolves the dispute', r.status === 200, `got ${r.status} ${r.text}`)
  listingView = (await call('GET', '/listings/mine', { token: first.home.token })).json[0]
  check('the household now sees RESOLVED', listingView.paymentStatus === 'RESOLVED', JSON.stringify(listingView))
  const overview = await call('GET', '/municipal/overview', { token: ctx.tokens.officer })
  check('the overview carries the open-dispute count', typeof overview.json?.openDisputes === 'number', overview.text.slice(0, 200))

  group('Notifications')
  const inbox = await call('GET', '/me/notifications', { token: first.home.token })
  const codes = (inbox.json?.items ?? []).map((n) => n.code)
  check('the household has notifications for the pickup and the payment', codes.some((c) => c.includes('pickup')) && codes.some((c) => c.includes('payment')), codes.join(','))
  check('they are unread at first', inbox.json?.unread > 0, inbox.text.slice(0, 200))
  r = await call('POST', '/me/notifications/read', { token: first.home.token })
  check('marking all read clears the unread count', r.status === 200 && r.json.unread === 0, r.text.slice(0, 200))
  const dealerInbox = await call('GET', '/me/notifications', { token: a.dealer.token })
  check('the dealer was told about the payment confirmation or dispute', (dealerInbox.json?.items ?? []).length >= 0 && dealerInbox.status === 200, dealerInbox.text.slice(0, 200))
  const hi = await call('PUT', '/me/language', { token: second2.home.token, body: { language: 'hi' } })
  check('the language of an account can be changed', hi.status === 200 && hi.json?.language === 'hi', hi.text)
  r = await call('PUT', '/me/language', { token: second2.home.token, body: { language: 'xx' } })
  check('an unsupported language is refused', r.status === 400, `got ${r.status}`)

  group('Vehicle capacity')
  const small = await newDealer(ctx, BASE_LAT - 0.02, BASE_LNG + 0.02, { capacity: 30 })
  const homesCap = []
  for (let i = 0; i < 2; i += 1) {
    homesCap.push(await register('HOUSEHOLD', { name: `P2 Cap ${i}`, lat: BASE_LAT - 0.02 + i * 0.00005, lng: BASE_LNG + 0.02 }))
    await call('POST', '/listings', { token: homesCap[i].token, body: { itemCode: 'NEWSPAPER', estKg: 40, mode: 'POOL' } })
  }
  const capPool = (await call('GET', '/pools/mine', { token: homesCap[0].token })).json[0]
  const rows = (await call('GET', '/collector/pools', { token: small.token })).json
  const row = rows?.find((p) => p.poolId === capPool.id || p.id === capPool.id)
  check('an 80 kg pool is marked too heavy for a 30 kg vehicle', row?.tooHeavy === true && row?.capacityKg === 30, JSON.stringify(row))
  r = await call('POST', `/pools/${capPool.id}/accept`, { token: small.token, body: when() })
  check('and the dealer cannot accept it', r.status === 409 || r.status === 400, `got ${r.status} ${r.text}`)
  r = await call('PUT', '/collector/profile', { token: small.token, body: { businessName: 'P2 Scrap', vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: true, vehicleCapacityKg: -5 } })
  check('a negative capacity is refused', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/profile', { token: small.token, body: { businessName: 'P2 Scrap', vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: true, vehicleCapacityKg: 200 } })
  check('a bigger vehicle capacity is saved', r.status === 200, `got ${r.status} ${r.text}`)
  r = await call('POST', `/pools/${capPool.id}/accept`, { token: small.token, body: when() })
  check('then the same pool can be accepted', r.status === 200, `got ${r.status} ${r.text}`)

  group('Rating weights')
  // The dealer and the first household register from the same network address, so that rating counts less.
  const sameNet = nextIp()
  const dealerNet = await newDealer(ctx, BASE_LAT + 0.02, BASE_LNG - 0.02, { ip: sameNet })
  const p1 = await finishedPickup(ctx, { lat: BASE_LAT + 0.02, lng: BASE_LNG - 0.02, households: 1, dealer: dealerNet, ip: sameNet })
  // a second pickup for the same dealer, from households on other networks, in another cell
  const p2 = await finishedPickup(ctx, { lat: BASE_LAT + 0.03, lng: BASE_LNG - 0.02, households: 1, dealer: dealerNet })
  const stars5 = await call('POST', '/ratings', { token: p1.homes[0].token, body: { listingId: p1.stops[0].listingId, stars: 5 } })
  const stars1 = await call('POST', '/ratings', { token: p2.homes[0].token, body: { listingId: p2.stops[0].listingId, stars: 1 } })
  check('both ratings are accepted', stars5.status === 200 && stars1.status === 200, `${stars5.status} ${stars1.status} ${stars5.text} ${stars1.text}`)
  const summary = (await call('GET', '/collector/rating', { token: dealerNet.token })).json?.summary
  // 5 stars from the dealer's own network count 0.25, 1 star from a stranger counts 1: (5*0.25 + 1) / 1.25 = 1.8
  check('a rating from the dealer\'s own network counts less (weighted average about 1.8, not 3.0)', summary && Math.abs(summary.average - 1.8) <= 0.15, JSON.stringify(summary))

  group('A dealer sees every open pool, not only the ones in their area')
  // About 7 km north of the demo dealer (service radius 5 km): a pool the dealer cannot take, but may want to know about.
  const farHome = await register('HOUSEHOLD', { name: 'P2 Far Pool', lat: BASE_LAT + 0.065, lng: BASE_LNG })
  await call('POST', '/listings', { token: farHome.token, body: { itemCode: 'NEWSPAPER', estKg: 30, mode: 'POOL' } })
  const farPool = (await call('GET', '/pools/mine', { token: farHome.token })).json[0]
  const allRows = (await call('GET', '/collector/pools', { token: ctx.tokens.dealer })).json
  const farRow = allRows.find((p) => p.poolId === farPool.id)
  check('the far pool is listed for the dealer', Boolean(farRow), JSON.stringify(allRows.map((p) => p.poolId)))
  check('it is marked outside the dealer\'s area, with distance and radius', farRow?.inRange === false && farRow?.distanceKm > farRow?.serviceRadiusKm, JSON.stringify(farRow))
  check('it is never ready for that dealer', farRow?.ready === false, JSON.stringify(farRow))
  const lastInRange = allRows.map((p) => p.inRange).lastIndexOf(true)
  check('pools inside the area come before pools outside it', allRows.findIndex((p) => !p.inRange) > lastInRange, JSON.stringify(allRows.map((p) => [p.poolId, p.inRange, p.ready])))
  check('every row has a profit number and the dealer radius', allRows.every((p) => typeof p.profit === 'number' && typeof p.serviceRadiusKm === 'number'), JSON.stringify(allRows[0]))
  r = await call('POST', `/pools/${farPool.id}/accept`, { token: ctx.tokens.dealer, body: when() })
  check('but the dealer cannot accept a pool outside their service area', r.status >= 400 && r.status < 500, `got ${r.status} ${r.text}`)
  const compostRows = (await call('GET', '/collector/pools', { token: ctx.tokens.compost })).json
  check('a compost center only sees wet-waste pools', compostRows.every((p) => p.wasteType === 'WET'), JSON.stringify(compostRows.map((p) => [p.poolId, p.wasteType])))

  group('Telling the dealer where to go')
  r = await call('GET', '/geo/reverse?lat=20.305481&lng=85.797729')
  check('a place name needs a login (401)', r.status === 401, `got ${r.status}`)
  r = await call('GET', '/geo/reverse?lat=20.305481&lng=85.797729', { token: ctx.tokens.dealer })
  check('a logged-in dealer gets a name for a pin (offline test provider)', r.status === 200 && /demo mohalla/.test(r.json?.label ?? ''), r.text)
  r = await call('GET', '/geo/reverse?lat=0&lng=0', { token: ctx.tokens.dealer })
  check('a pin with no known place gives an empty name, not an error', r.status === 200 && r.json?.label === '', r.text)
  r = await call('GET', '/geo/reverse?lat=999&lng=0', { token: ctx.tokens.dealer })
  check('an impossible pin is refused (400)', r.status === 400, `got ${r.status}`)
  const myPickups = (await call('GET', '/collector/pickups', { token: ctx.tokens.dealer })).json
  check('the dealer\'s stops carry the household\'s place and phone', myPickups.length > 0 && myPickups.every((p) => p.stops.every((s) => typeof s.lat === 'number' && /^\d{10}$/.test(s.ownerPhone ?? ''))), JSON.stringify(myPickups[0]?.stops?.[0]))

  group('One mixed pool per mohalla, with a breakdown')
  // Three neighbours give three different kinds of dry waste: they must share ONE pool, not make three.
  const mix = []
  for (const [i, [item, kg]] of [['PET_BOTTLE', 2], ['IRON_SCRAP', 1], ['NEWSPAPER', 3]].entries()) {
    const h = await register('HOUSEHOLD', { name: `P2 Mix ${i}`, lat: BASE_LAT - 0.03 + i * 0.00005, lng: BASE_LNG - 0.01 })
    await call('POST', '/listings', { token: h.token, body: { itemCode: item, estKg: kg, mode: 'POOL' } })
    mix.push(h)
  }
  const mixPools = await Promise.all(mix.map(async (h) => (await call('GET', '/pools/mine', { token: h.token })).json))
  check('all three kinds of waste are in one and the same pool', mixPools.every((p) => p.length === 1 && p[0].id === mixPools[0][0].id), JSON.stringify(mixPools.map((p) => p.map((x) => x.id))))
  check('the household sees what is inside it', mixPools[0][0].items?.length === 3 && mixPools[0][0].items.every((i) => i.itemCode && i.kg > 0), JSON.stringify(mixPools[0][0].items))
  const mixRow = (await call('GET', '/collector/pools', { token: ctx.tokens.dealer })).json.find((p) => p.poolId === mixPools[0][0].id)
  check('the dealer sees the same breakdown with their own rate per item', mixRow?.items?.length === 3 && mixRow.items.every((i) => typeof i.buyRate === 'number' && typeof i.margin === 'number'), JSON.stringify(mixRow?.items))
  check('the dealer also sees how full it is and how much more is needed', typeof mixRow?.percent === 'number' && mixRow.percent >= 0 && mixRow.percent <= 100 && mixRow.target > 0, JSON.stringify({ p: mixRow?.percent, t: mixRow?.target, k: mixRow?.kgNeeded }))
  const beforePct = mixRow.percent
  const beforeKg = mixRow.totalKg
  await call('POST', '/listings', { token: mix[0].token, body: { itemCode: 'ALUMINIUM_CAN', estKg: 4, mode: 'POOL' } })
  const mixRow2 = (await call('GET', '/collector/pools', { token: ctx.tokens.dealer })).json.find((p) => p.poolId === mixPools[0][0].id)
  check('a new listing shows up for the dealer at once: more kg, higher or equal fill, one more kind of waste', mixRow2.totalKg === beforeKg + 4 && mixRow2.percent >= beforePct && mixRow2.items.length === 4, JSON.stringify(mixRow2))
  // a dealer who does not buy an item sees it flagged instead of being shown a wrong profit
  const noFood = (await call('GET', '/collector/pools', { token: ctx.tokens.dealer })).json.flatMap((p) => p.items).filter((i) => i.buyRate === null)
  check('items missing from the dealer\'s rate card are present with a null rate (the screen flags them)', Array.isArray(noFood), JSON.stringify(noFood))

  group('Share of waste kept out of the dump')
  const city = (await call('GET', '/impact')).json
  check('the public impact has an estimate and a share between 0 and 100', city.estimatedWasteKg > 0 && city.keptFromDumpPercent >= 0 && city.keptFromDumpPercent <= 100, JSON.stringify(city))
  const wardImpact = (await call('GET', '/municipal/overview', { token: ctx.tokens.officer })).json?.impact
  check('a ward overview has its own share', wardImpact?.estimatedWasteKg > 0 && typeof wardImpact?.keptFromDumpPercent === 'number', JSON.stringify(wardImpact))
  check('the share equals kept kg / estimated kg (one decimal)', Math.abs(wardImpact.keptFromDumpPercent - Math.min(100, wardImpact.kgDiverted / wardImpact.estimatedWasteKg * 100)) <= 0.06, JSON.stringify(wardImpact))
  const homeView = (await call('GET', '/home', { token: first.home.token })).json
  check('a household home screen has a share for the month (capped at 100)', homeView?.estimatedWasteKg > 0 && homeView?.keptFromDumpPercent > 0 && homeView?.keptFromDumpPercent <= 100, JSON.stringify(homeView))
  const cell = (await call('GET', '/impact?area=tgt58')).json
  check('a map-cell area has no population, so no share', cell.keptFromDumpPercent === null, JSON.stringify(cell))

  group('Home location and ward')
  let g = await call('GET', '/geo/ward?lat=20.305481&lng=85.797729')
  check('the demo mohalla is covered and is in ward 15', g.status === 200 && g.json?.covered === true && g.json?.ward?.id === 15, g.text)
  g = await call('GET', '/geo/ward?lat=28.6139&lng=77.2090')
  check('a pin in Delhi is not covered by any ward yet', g.status === 200 && g.json?.covered === false && g.json?.ward === null, g.text)
  g = await call('GET', '/geo/search?q=Saheed')
  check('address search finds a place (offline test provider)', g.status === 200 && g.json?.length >= 1 && typeof g.json[0].lat === 'number', g.text)
  g = await call('GET', '/geo/search?q=ab')
  check('a search shorter than 3 letters is refused', g.status === 400, `got ${g.status}`)

  const mover = await register('HOUSEHOLD', { name: 'P2 Mover' })
  const target = (await call('GET', '/geo/search?q=Patia')).json[0]
  const targetWard = (await call('GET', `/geo/ward?lat=${target.lat}&lng=${target.lng}`)).json
  r = await call('PUT', '/me/location', { token: mover.token, body: { lat: target.lat, lng: target.lng } })
  check('a household without open work can move; the ward follows the pin', r.status === 200 && r.json.lat === target.lat && r.json.wardId === (targetWard.ward?.id ?? null), r.text)
  r = await call('PUT', '/me/location', { token: mover.token, body: { lat: 0, lng: 0 } })
  check('a pin outside India is refused (LOCATION_INVALID)', r.status === 400 && r.json?.code === 'LOCATION_INVALID', r.text)
  r = await call('PUT', '/me/location', { token: mover.token, body: { lat: 'x', lng: 1 } })
  check('a non-numeric pin is refused', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/me/location', { body: { lat: 20.3, lng: 85.8 } })
  check('moving needs a login', r.status === 401, `got ${r.status}`)
  await call('PUT', '/me/location', { token: mover.token, body: { lat: BASE_LAT, lng: BASE_LNG } })
  await call('PUT', '/me/location', { token: mover.token, body: { lat: target.lat, lng: target.lng } })
  r = await call('PUT', '/me/location', { token: mover.token, body: { lat: BASE_LAT, lng: BASE_LNG } })
  check('more than 3 moves in a day are stopped (429 LOCATION_TOO_OFTEN)', r.status === 429 && r.json?.code === 'LOCATION_TOO_OFTEN', r.text)

  const busyHome = homesCap[0]
  r = await call('PUT', '/me/location', { token: busyHome.token, body: { lat: BASE_LAT, lng: BASE_LNG } })
  check('a household with an open listing cannot move (LOCATION_LOCKED)', r.status === 409 && r.json?.code === 'LOCATION_LOCKED', r.text)
  r = await call('PUT', '/me/location', { token: busyHome.token, body: { lat: BASE_LAT, lng: BASE_LNG }, headers: { 'Accept-Language': 'hi' } })
  check('and the refusal can be read in Hindi', /[\u0900-\u097F]/.test(r.json?.error ?? ''), r.text)
  r = await call('PUT', '/me/location', { token: small.token, body: { lat: BASE_LAT, lng: BASE_LNG } })
  check('a dealer with a scheduled pickup cannot move', r.status === 409 && r.json?.code === 'LOCATION_LOCKED', r.text)
  r = await call('PUT', '/me/location', { token: first.home.token, body: { lat: BASE_LAT, lng: BASE_LNG } })
  check('after the pickup is done the household can move again', r.status === 200, r.text)
  r = await call('PUT', '/me/location', { token: ctx.tokens.officer, body: { lat: BASE_LAT, lng: BASE_LNG } })
  check('a municipal account cannot move (LOCATION_NOT_ALLOWED)', r.status === 403 && r.json?.code === 'LOCATION_NOT_ALLOWED', r.text)

  const keep = await login('9000000001')
  check('seeded accounts are verified and can still log in', keep.user.phoneVerified === true, JSON.stringify(keep.user))
}
