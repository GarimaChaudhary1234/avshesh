import {
  BASE_LAT, BASE_LNG, call, check, group, imageForm, istLocal, login, register,
} from './harness.mjs'

const listing = (token, itemCode, estKg, extra = {}) =>
  call('POST', '/listings', { token, body: { itemCode, estKg, mode: 'POOL', ...extra } })

const poolOf = async (token) => (await call('GET', '/pools/mine', { token })).json?.[0]

/** Runs against a freshly seeded database. It changes data, so reset the stack before running it again. */
export async function business(ctx) {
  const { dealer, compost, pending, officer, household } = ctx.tokens

  group('Catalog and routing of waste')
  let r = await call('GET', '/catalog')
  const byCategory = {}
  r.json.forEach((i) => { byCategory[i.category] = (byCategory[i.category] ?? 0) + 1 })
  check('catalog has dry, wet, general and hazardous items', r.status === 200 && ['DRY', 'WET', 'GENERAL', 'HAZARDOUS'].every((c) => byCategory[c] > 0),
    JSON.stringify(byCategory))

  const alpha = await register('HOUSEHOLD', { name: 'QA Alpha' })
  const beta = await register('HOUSEHOLD', { name: 'QA Beta', lat: BASE_LAT + 0.0003, lng: BASE_LNG - 0.0002 })

  r = await listing(alpha.token, 'BATTERY', 1)
  check('hazardous waste cannot be listed for sale', r.status === 400, `got ${r.status}`)
  r = await listing(alpha.token, 'DUST_SWEEPINGS', 2)
  check('general waste cannot be listed for sale', r.status === 400 && /municipal/i.test(r.json?.error ?? ''), `got ${r.status} ${r.text}`)
  r = await call('POST', '/municipal-requests', { token: alpha.token, body: { itemCode: 'PET_BOTTLE', estKg: 2 } })
  check('recyclable waste cannot be sent to the municipal corporation', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/municipal-requests', { token: alpha.token, body: { itemCode: 'SANITARY_WASTE', estKg: 2 } })
  check('sanitary waste can', r.status === 200, `got ${r.status}`)

  group('Mohalla Pool')
  const seeded = await login('9000000002') // Asha, already in the demo pool
  const seededPool = await poolOf(seeded.token)
  check('demo pool is filling and below target', seededPool && seededPool.status === 'FILLING' && seededPool.percent < 100,
    JSON.stringify(seededPool))

  r = await listing(alpha.token, 'PET_BOTTLE', 5)
  check('first listing joins the neighbours\' pool', r.status === 200 && r.json.poolId === seededPool.id, `got pool ${r.json?.poolId}, expected ${seededPool.id}`)
  const afterFirst = await poolOf(alpha.token)
  check('pool percent goes up after a listing', afterFirst.percent > seededPool.percent, `${seededPool.percent} -> ${afterFirst.percent}`)

  r = await listing(beta.token, 'NEWSPAPER', 8)
  const readyPool = await poolOf(beta.token)
  check('pool becomes READY once a dealer can profit enough', readyPool.status === 'READY' && readyPool.percent === 100, JSON.stringify(readyPool))

  r = await listing(alpha.token, 'FOOD_WASTE', 3)
  const wetPool = (await call('GET', '/pools/mine', { token: alpha.token })).json.find((p) => p.wasteType === 'WET')
  check('wet waste goes to a separate wet pool', wetPool && wetPool.id !== seededPool.id, JSON.stringify(wetPool))
  check('a 3 kg wet pool is not ready (compost center needs 50 kg)', wetPool?.status === 'FILLING', JSON.stringify(wetPool))

  const dropoff = await call('POST', '/listings', { token: alpha.token, body: { itemCode: 'CARDBOARD', estKg: 4, mode: 'SELF_DROP' } })
  const poolAfterDrop = await poolOf(alpha.token)
  check('self drop-off listing stays out of the pool', dropoff.status === 200 && dropoff.json.poolId === null && poolAfterDrop.totalKg === readyPool.totalKg,
    `poolId=${dropoff.json?.poolId} total ${readyPool.totalKg} -> ${poolAfterDrop.totalKg}`)

  group('Parallel first listings in a brand new area')
  // Ten households in the same new cell list at the same moment: one pool, nothing lost.
  const eLat = BASE_LAT - 0.02
  const crowd = await Promise.all(Array.from({ length: 10 }, (_, i) => register('HOUSEHOLD', { name: `QA Crowd ${i}`, lat: eLat, lng: BASE_LNG })))
  const created = await Promise.all(crowd.map((u) => listing(u.token, 'NEWSPAPER', 2)))
  const poolIds = new Set(created.map((c) => c.json?.poolId))
  check('ten simultaneous first listings all succeed', created.every((c) => c.status === 200), created.map((c) => c.status).join(','))
  check('they end up in one pool, not several', poolIds.size === 1, `pool ids: ${[...poolIds].join(',')}`)
  const crowdPool = await poolOf(crowd[0].token)
  check('the pool total equals the sum of all ten listings (20 kg)', crowdPool?.totalKg === 20 && crowdPool?.households === 10,
    JSON.stringify(crowdPool))

  group('Neighbours across a map-cell edge still share a pool')
  // These two homes are about 4 m apart but on opposite sides of a geohash cell edge.
  // A precision-6 geohash cell is 180/2^15 degrees tall and BASE_LAT is the centre of one, so the northern edge of
  // the cell four rows above it is BASE_LAT + 4.5 cells. It is about 2.7 km from the demo pool.
  const CELL = 180 / 2 ** 15
  const edgeLat = BASE_LAT + 4.5 * CELL
  const edgeLng = BASE_LNG
  const north = await register('HOUSEHOLD', { name: 'QA Edge North', lat: edgeLat + 0.00002, lng: edgeLng })
  const south = await register('HOUSEHOLD', { name: 'QA Edge South', lat: edgeLat - 0.00002, lng: edgeLng })
  const [n1, s1] = [await listing(north.token, 'NEWSPAPER', 3), await listing(south.token, 'NEWSPAPER', 3)]
  check('two homes 4 m apart land in the same pool', n1.status === 200 && s1.status === 200 && n1.json.poolId === s1.json.poolId,
    `pools ${n1.json?.poolId} and ${s1.json?.poolId}`)
  const farHome = await register('HOUSEHOLD', { name: 'QA Far Home', lat: edgeLat + 0.02, lng: edgeLng })
  const f1 = await listing(farHome.token, 'NEWSPAPER', 3)
  check('a home 2 km away gets its own pool', f1.status === 200 && f1.json.poolId !== n1.json.poolId, `pool ${f1.json?.poolId}`)

  group('Collector rules before accepting')
  const when = { start: istLocal(24), end: istLocal(26) }
  const poolId = readyPool.id
  r = await call('POST', `/pools/${poolId}/accept`, { token: household, body: when })
  check('a household cannot accept a pool', r.status === 403, `got ${r.status}`)
  r = await call('POST', `/pools/${poolId}/accept`, { token: compost, body: when })
  check('a compost center cannot take a dry pool', r.status === 409, `got ${r.status}`)
  r = await call('POST', `/pools/${poolId}/accept`, { token: pending, body: when })
  check('an unverified dealer cannot accept', r.status === 409, `got ${r.status}`)
  r = await call('GET', '/collector/pools', { token: pending })
  check('an unverified dealer sees no pools', r.json?.length === 0, JSON.stringify(r.json))
  r = await call('POST', `/pools/${poolId}/accept`, { token: dealer, body: { start: istLocal(26), end: istLocal(24) } })
  check('end before start -> 400', r.status === 400, `got ${r.status}`)
  // a separate READY pool, so that a bug in this check cannot accept the main pool by mistake
  const delta = await register('HOUSEHOLD', { name: 'QA Delta', lat: BASE_LAT + 0.015, lng: BASE_LNG })
  await listing(delta.token, 'NEWSPAPER', 60)
  const deltaPool = await poolOf(delta.token)
  r = await call('POST', `/pools/${deltaPool.id}/accept`, { token: dealer, body: { start: istLocal(-1), end: istLocal(1) } })
  check('a start one hour ago (India time) -> 400', r.status === 400, `got ${r.status}: the server compares against UTC, not India time`)
  r = await call('POST', `/pools/${poolId}/accept`, { token: dealer, body: { start: istLocal(24) } })
  check('missing end -> 400', r.status === 400, `got ${r.status}`)

  group('Two dealers accepting the same pool at once')
  const d2 = await register('KABADIWALA', { name: 'QA Dealer Two', lat: BASE_LAT + 0.002, lng: BASE_LNG + 0.001 })
  await call('PUT', '/collector/profile', { token: d2.token, body: { businessName: 'QA Scrap Two', vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: true } })
  await call('PUT', '/collector/rate-card', {
    token: d2.token,
    body: { serviceRadiusKm: 5, minTripProfit: 100, minLoadKg: 0, items: [
      { itemCode: 'PET_BOTTLE', buyRate: 13, sellRate: 18 }, { itemCode: 'NEWSPAPER', buyRate: 14, sellRate: 19 },
      { itemCode: 'CARDBOARD', buyRate: 7, sellRate: 10 }, { itemCode: 'IRON_SCRAP', buyRate: 30, sellRate: 36 },
      { itemCode: 'ALUMINIUM_CAN', buyRate: 100, sellRate: 115 }] },
  })
  r = await call('GET', '/collector/pools', { token: d2.token })
  check('a new dealer cannot see pools before verification', r.json?.length === 0, JSON.stringify(r.json))
  const d2Id = d2.user.id
  r = await call('POST', `/municipal/collectors/${d2Id}/verification`, { token: officer, body: { status: 'VERIFIED' } })
  check('ward officer verifies the new dealer', r.status === 200, `got ${r.status}`)

  const [a, b] = await Promise.all([
    call('POST', `/pools/${poolId}/accept`, { token: dealer, body: when }),
    call('POST', `/pools/${poolId}/accept`, { token: d2.token, body: when }),
  ])
  const statuses = [a.status, b.status].sort()
  check('exactly one of two simultaneous accepts wins', statuses[0] === 200 && statuses[1] === 409, `statuses ${a.status} / ${b.status}`)
  const winner = a.status === 200 ? { token: dealer, pickup: a.json } : { token: d2.token, pickup: b.json }
  const loser = a.status === 200 ? d2.token : dealer
  check('the pickup lists every household of the pool', winner.pickup.stops.length >= 7, `stops=${winner.pickup.stops.length}`)

  r = await call('POST', `/pools/${poolId}/accept`, { token: winner.token, body: when })
  check('accepting the same pool again -> 409', r.status === 409, `got ${r.status}`)

  group('Pickup and payment')
  const pickupId = winner.pickup.id
  const stopOf = (name, item) => winner.pickup.stops.find((s) => s.ownerName === name && s.itemCode === item)
  const alphaStop = stopOf('QA Alpha', 'PET_BOTTLE')
  const betaStop = stopOf('QA Beta', 'NEWSPAPER')

  r = await call('GET', `/pickups/${pickupId}/route`, { token: loser })
  check('the other dealer cannot read this pickup', r.status === 403, `got ${r.status}`)
  const routeText = JSON.stringify(winner.pickup)
  check('each stop tells the dealer where to go and who to call', winner.pickup.stops.every((s) => typeof s.lat === 'number' && typeof s.lng === 'number' && /^\d{10}$/.test(s.ownerPhone ?? '')), routeText.slice(0, 200))
  check('there is no OTP anywhere in the route', !/otp/i.test(routeText), routeText.slice(0, 120))

  const myListings = (await call('GET', '/listings/mine', { token: alpha.token })).json
  const alphaPet = myListings.find((l) => l.itemCode === 'PET_BOTTLE')
  check('the household sees the pickup time (and no code to show)', Boolean(alphaPet.pickupStart) && !('otp' in alphaPet), JSON.stringify(alphaPet))

  r = await call('POST', `/pickups/stops/${alphaStop.stopId}/complete`, { token: loser, body: { actualKg: 5, paymentMode: 'CASH' } })
  check('another dealer cannot complete this stop', r.status === 403, `got ${r.status}`)
  r = await call('POST', `/pickups/stops/${alphaStop.stopId}/complete`, { token: winner.token, body: { actualKg: 5, paymentMode: 'BITCOIN' } })
  check('an unknown payment mode -> 400', r.status === 400, `got ${r.status}`)
  for (const kg of [0, -2]) {
    r = await call('POST', `/pickups/stops/${alphaStop.stopId}/complete`, { token: winner.token, body: { actualKg: kg, paymentMode: 'CASH' } })
    check(`weight ${kg} kg -> 400`, r.status === 400, `got ${r.status}`)
  }
  r = await call('POST', `/pickups/stops/${alphaStop.stopId}/complete`, { token: winner.token, body: { actualKg: 100000, paymentMode: 'CASH' } })
  check('an absurd weight (100000 kg) is refused', r.status === 400, `got ${r.status}: it would record a huge payment`)

  const rate = (await call('GET', '/collector/rate-card', { token: winner.token })).json.items.find((i) => i.itemCode === 'PET_BOTTLE').buyRate
  r = await call('POST', `/pickups/stops/${alphaStop.stopId}/complete`, { token: winner.token, body: { actualKg: 5.4, paymentMode: 'UPI' } })
  check('the dealer completes the stop and pays weight x rate', r.status === 200 && Math.abs(r.json.amount - 5.4 * rate) < 0.01,
    `got ${r.status} ${r.text}`)
  r = await call('POST', `/pickups/stops/${alphaStop.stopId}/complete`, { token: winner.token, body: { actualKg: 5.4, paymentMode: 'UPI' } })
  check('completing a stop twice -> 409', r.status === 409, `got ${r.status}`)

  group('Money and numbers stay consistent')
  const paid = 5.4 * rate
  r = await call('GET', '/home', { token: alpha.token })
  check('household home shows what was earned', Math.abs(r.json.earnedThisMonth - paid) < 0.01 && Math.abs(r.json.kgSaved - 5.4) < 0.01, JSON.stringify(r.json))
  r = await call('GET', '/collector/earnings?days=7', { token: winner.token })
  check('dealer earnings count a stop as soon as it is done (not only whole pickups)', r.json.kg >= 5.4 && r.json.paidToHouseholds >= paid - 0.01,
    JSON.stringify(r.json))
  r = await call('GET', '/impact')
  check('public impact counts the collected kilograms and payments', r.json.kgDiverted >= 5.4 && r.json.paidToHouseholds >= paid - 0.01, JSON.stringify(r.json))
  const ward = (await call('GET', '/municipal/overview', { token: officer })).json
  check('ward overview shows the same kilograms', ward.impact.kgDiverted >= 5.4, JSON.stringify(ward.impact))

  group('Ratings')
  const betaListing = (await call('GET', '/listings/mine', { token: beta.token })).json.find((l) => l.itemCode === 'NEWSPAPER')
  r = await call('POST', '/ratings', { token: beta.token, body: { listingId: betaListing.id, stars: 4 } })
  check('cannot rate before the pickup is completed', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/ratings', { token: beta.token, body: { listingId: alphaPet.id, stars: 1 } })
  check('cannot rate someone else\'s pickup', r.status === 403, `got ${r.status}`)
  r = await call('POST', '/ratings', { token: alpha.token, body: { listingId: alphaPet.id, stars: 4, comment: 'Quick and fair' } })
  check('rate a completed pickup', r.status === 200, `got ${r.status}`)
  r = await call('POST', '/ratings', { token: alpha.token, body: { listingId: alphaPet.id, stars: 1 } })
  check('rating twice -> 409', r.status === 409, `got ${r.status}`)
  r = await call('GET', '/collector/rating', { token: winner.token })
  check('the dealer sees the rating', r.json.summary.count === 1 && r.json.summary.average === 4, JSON.stringify(r.json))

  group('Pickup date versus when the waste is ready')
  const farLat = BASE_LAT + 0.02
  const gamma = await register('HOUSEHOLD', { name: 'QA Gamma', lat: farLat, lng: BASE_LNG })
  const readyIn5 = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10)
  r = await listing(gamma.token, 'NEWSPAPER', 60, { readyFrom: readyIn5 })
  const farPool = await poolOf(gamma.token)
  check('a large far pool is READY', r.status === 200 && farPool?.status === 'READY', JSON.stringify(farPool))
  r = await call('POST', `/pools/${farPool.id}/accept`, { token: winner.token, body: { start: istLocal(24), end: istLocal(26) } })
  check('a pickup cannot be booked before the waste is ready (ready in 5 days)', r.status === 400, `got ${r.status}`)

  group('A paused dealer does not leave stale READY pools')
  await call('PUT', '/collector/profile', { token: dealer, body: { vehicleType: 'E_RICKSHAW', costPerKm: 8, acceptingPickups: false } })
  await call('PUT', '/collector/profile', { token: d2.token, body: { vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: false } })
  const stale = await poolOf(gamma.token)
  check('with every dealer paused the pool is no longer shown as READY to the household', stale.status !== 'READY', JSON.stringify(stale))
  await call('PUT', '/collector/profile', { token: dealer, body: { vehicleType: 'E_RICKSHAW', costPerKm: 8, acceptingPickups: true, businessName: 'Ramesh Scrap Traders' } })
  await call('PUT', '/collector/profile', { token: d2.token, body: { vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: true } })

  group('A dealer who comes back can accept a pool that was marked FILLING meanwhile')
  const hLat = BASE_LAT - 0.03
  const eta = await register('HOUSEHOLD', { name: 'QA Eta', lat: hLat, lng: BASE_LNG })
  await listing(eta.token, 'NEWSPAPER', 60)
  const etaPool = await poolOf(eta.token)
  check('the pool starts READY', etaPool?.status === 'READY', JSON.stringify(etaPool))
  await call('PUT', '/collector/profile', { token: dealer, body: { vehicleType: 'E_RICKSHAW', costPerKm: 8, acceptingPickups: false, businessName: 'Ramesh Scrap Traders' } })
  await call('PUT', '/collector/profile', { token: d2.token, body: { vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: false } })
  const theta = await register('HOUSEHOLD', { name: 'QA Theta', lat: hLat + 0.0002, lng: BASE_LNG })
  await listing(theta.token, 'NEWSPAPER', 1)
  await call('PUT', '/collector/profile', { token: dealer, body: { vehicleType: 'E_RICKSHAW', costPerKm: 8, acceptingPickups: true, businessName: 'Ramesh Scrap Traders' } })
  await call('PUT', '/collector/profile', { token: d2.token, body: { vehicleType: 'E_RICKSHAW', costPerKm: 6, acceptingPickups: true } })
  const rows = (await call('GET', '/collector/pools', { token: dealer })).json
  const row = rows.find((p) => p.poolId === etaPool.id)
  check('the dealer dashboard lists the pool as ready again', row?.ready === true, JSON.stringify(row))
  r = await call('POST', `/pools/${etaPool.id}/accept`, { token: dealer, body: { start: istLocal(24), end: istLocal(26) } })
  check('and accepting it works', r.status === 200, `got ${r.status} ${r.text.slice(0, 120)}`)

  group('Municipal corporation')
  const staffList = (await call('GET', '/municipal/staff', { token: officer })).json
  const open = (await call('GET', '/municipal/requests', { token: officer })).json.find((x) => x.status === 'OPEN')
  r = await call('PUT', `/municipal/requests/${open.id}`, { token: officer, body: { status: 'SCHEDULED', scheduledFor: istLocal(24).slice(0, 10) } })
  check('scheduling needs a staff member', r.status === 400, `got ${r.status}`)
  await call('PUT', `/municipal/staff/${staffList[0].id}`, { token: officer, body: { active: false } })
  r = await call('PUT', `/municipal/requests/${open.id}`, { token: officer, body: { status: 'SCHEDULED', scheduledFor: istLocal(24).slice(0, 10), staffId: staffList[0].id } })
  check('an inactive staff member cannot be assigned', r.status === 400, `got ${r.status}`)
  await call('PUT', `/municipal/staff/${staffList[0].id}`, { token: officer, body: { active: true } })
  r = await call('PUT', `/municipal/requests/${open.id}`, { token: officer, body: { status: 'SCHEDULED', scheduledFor: istLocal(24).slice(0, 10), staffId: staffList[0].id } })
  check('an active staff member can', r.status === 200 && r.json.staffName, `got ${r.status} ${r.text.slice(0, 100)}`)
  r = await call('PUT', `/municipal/requests/${open.id}`, { token: officer, body: { status: 'COLLECTED' } })
  check('marking collected', r.status === 200 && r.json.status === 'COLLECTED', `got ${r.status}`)

  group('Speed')
  const timings = []
  for (const [t, p] of [[household, '/home'], [dealer, '/collector/pools'], [officer, '/municipal/overview'], [officer, '/municipal/collectors']]) {
    const samples = []
    for (let i = 0; i < 5; i++) samples.push((await call('GET', p, { token: t })).ms)
    samples.sort((x, y) => x - y)
    timings.push(`${p} median ${samples[2].toFixed(0)} ms`)
    check(`${p} answers in under 500 ms (median)`, samples[2] < 500, `median ${samples[2].toFixed(0)} ms`)
  }
  console.log('  info  ' + timings.join(' | '))

  group('Abuse protection')
  const spammer = await register('HOUSEHOLD', { name: 'QA Spammer' })
  let throttled = 0
  for (let i = 0; i < 45; i++) {
    const s = await call('POST', '/scan', { token: spammer.token, form: imageForm(undefined, { hint: 'PET_BOTTLE' }) })
    if (s.status === 429) throttled += 1
  }
  check('too many scans in a short time are throttled (each scan costs AI money)', throttled > 0, 'all 45 scans were accepted')
}
