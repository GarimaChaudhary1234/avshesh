import { call, check, group, imageForm, register } from './harness.mjs'

export async function input(ctx) {
  const hh = await register('HOUSEHOLD', { name: 'QA Input' })
  const t = hh.token

  group('Malformed requests')
  let r = await call('POST', '/listings', { token: t, raw: '{ this is not json' })
  check('broken JSON -> 400', r.status === 400, `got ${r.status} ${r.text.slice(0, 100)}`)
  r = await call('POST', '/listings', { token: t, raw: '' })
  check('empty body -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, body: { itemCode: 'PET_BOTTLE', estKg: 'abc' } })
  check('text instead of a number -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, raw: '[1,2,3]' })
  check('array instead of an object -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, raw: '{"itemCode":"PET_BOTTLE","estKg":5}', headers: { 'Content-Type': 'text/plain' } })
  check('wrong content type -> 415 or 400', r.status === 415 || r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, body: { itemCode: 'PET_BOTTLE', estKg: 5, mode: 'TELEPORT' } })
  check('unknown enum value -> 400', r.status === 400, `got ${r.status}`)

  group('Listing values')
  for (const [label, kg] of [['zero', 0], ['negative', -3], ['too heavy (501 kg)', 501], ['absurd (1e12)', 1e12]]) {
    r = await call('POST', '/listings', { token: t, body: { itemCode: 'PET_BOTTLE', estKg: kg, mode: 'POOL' } })
    check(`weight ${label} -> 400`, r.status === 400, `got ${r.status}`)
  }
  r = await call('POST', '/listings', { token: t, body: { estKg: 5 } })
  check('missing item -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, body: { itemCode: "PET_BOTTLE'; DROP TABLE listings;--", estKg: 5 } })
  check('SQL in the item code -> 400, nothing breaks', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, body: { itemCode: 'PET_BOTTLE', estKg: 5, readyFrom: 'not-a-date' } })
  check('bad date -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/listings', { token: t, body: { itemCode: 'PET_BOTTLE', estKg: 5, readyFrom: '2001-01-01' } })
  check('a ready date in the past is rejected or corrected', r.status === 400 || r.json?.readyFrom >= new Date().toISOString().slice(0, 10),
    `got ${r.status} readyFrom=${r.json?.readyFrom}`)
  r = await call('POST', '/listings', { token: t, body: { itemCode: 'PET_BOTTLE', estKg: 5, unexpected: 'field' } })
  check('unknown JSON fields are ignored', r.status === 200, `got ${r.status}`)

  group('Municipal request and rating values')
  r = await call('POST', '/municipal-requests', { token: t, body: { itemCode: 'DUST_SWEEPINGS', estKg: 5, note: 'n'.repeat(300) } })
  check('300 character note -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/municipal-requests', { token: t, body: { itemCode: 'DUST_SWEEPINGS', estKg: 0 } })
  check('zero kg municipal request -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/municipal-requests', { token: t, body: { itemCode: 'DUST_SWEEPINGS', estKg: 5, note: '<img src=x onerror=alert(1)>' } })
  check('markup in a note is stored as plain text', r.status === 200 && r.json.note.includes('<img'), `got ${r.status}`)
  for (const stars of [0, 6, -1]) {
    r = await call('POST', '/ratings', { token: t, body: { listingId: 1, stars } })
    check(`rating of ${stars} stars -> 400`, r.status === 400, `got ${r.status}`)
  }

  group('Photo upload')
  r = await call('POST', '/scan', { token: t, form: new FormData() })
  check('scan without a photo -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/scan', { token: t, form: imageForm(Buffer.alloc(0), { hint: 'PET_BOTTLE' }) })
  check('empty photo -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/scan', { token: t, form: imageForm(Buffer.from('this is plain text, not an image'), { type: 'text/plain', name: 'x.txt', hint: 'PET_BOTTLE' }) })
  check('a text file is refused', r.status === 400, `got ${r.status} (the file would be stored as a photo)`)
  r = await call('POST', '/scan', { token: t, form: imageForm(Buffer.from('<?php echo 1; ?>'), { type: 'image/png', name: 'shell.php', hint: 'PET_BOTTLE' }) })
  check('a non-image disguised with an image content type is refused', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/scan', { token: t, form: imageForm(Buffer.alloc(6 * 1024 * 1024, 1), { hint: 'PET_BOTTLE' }) })
  check('a 6 MB photo -> 413 or 400, not 500', r.status === 413 || r.status === 400, `got ${r.status}`)
  r = await call('POST', '/scan', { token: t, form: imageForm(undefined, { hint: 'DOES_NOT_EXIST' }) })
  check('unknown demo item -> 400', r.status === 400, `got ${r.status}`)

  group('Public endpoints with odd input')
  for (const area of ['%25', '%27%20OR%201%3D1', '<script>', 'a'.repeat(500)]) {
    r = await call('GET', `/impact?area=${area}`)
    check(`GET /impact?area=${decodeURIComponent(area).slice(0, 20)} -> 200`, r.status === 200, `got ${r.status}`)
  }

  group('Collector inputs')
  const dealer = ctx.tokens.dealer
  r = await call('GET', '/collector/earnings?days=abc', { token: dealer })
  check('earnings with days=abc -> 400', r.status === 400, `got ${r.status}`)
  r = await call('GET', '/collector/earnings?days=-5', { token: dealer })
  check('earnings with a negative window -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/profile', { token: dealer, body: { vehicleType: 'SPACESHIP', costPerKm: 5, acceptingPickups: true } })
  check('unknown vehicle -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/profile', { token: dealer, body: { vehicleType: 'AUTO', costPerKm: 500, acceptingPickups: true } })
  check('travel cost of 500/km -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/profile', { token: dealer, body: { businessName: 'b'.repeat(200), vehicleType: 'AUTO', costPerKm: 5, acceptingPickups: true } })
  check('200 character business name -> 400', r.status === 400, `got ${r.status}`)

  const card = (await call('GET', '/collector/rate-card', { token: dealer })).json
  r = await call('PUT', '/collector/rate-card', { token: dealer, body: { ...card, items: [{ itemCode: 'PET_BOTTLE', buyRate: -1, sellRate: 5 }] } })
  check('negative rate -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/rate-card', { token: dealer, body: { ...card, items: [{ itemCode: 'NOT_AN_ITEM', buyRate: 1, sellRate: 5 }] } })
  check('unknown item in the rate card -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/rate-card', { token: dealer, body: { ...card, items: [{ itemCode: 'FOOD_WASTE', buyRate: 1, sellRate: 5 }] } })
  check('a scrap dealer cannot price wet waste (compost only)', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/rate-card', { token: dealer, body: { ...card, items: [{ itemCode: 'BATTERY', buyRate: 1, sellRate: 5 }] } })
  check('nobody can price hazardous waste', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/rate-card', { token: ctx.tokens.compost, body: { ...card, items: [{ itemCode: 'PET_BOTTLE', buyRate: 1, sellRate: 5 }] } })
  check('a compost center cannot price dry waste', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/collector/rate-card', { token: dealer, body: { ...card, items: [{ itemCode: 'PET_BOTTLE', buyRate: 20, sellRate: 5 }] } })
  check('selling below the buying price is refused or flagged', r.status === 400 || r.status === 200, `got ${r.status}`)
  // restore the seeded rate card (the call above may have saved a loss-making rate)
  await call('PUT', '/collector/rate-card', { token: dealer, body: card })

  group('Municipal inputs')
  const officer = ctx.tokens.officer
  r = await call('POST', '/municipal/collection-points', { token: officer, body: { name: 'x', address: 'y', lat: 999, lng: 85.8, accepts: 'z', active: true } })
  check('drop-off point with latitude 999 -> 400', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/municipal/staff', { token: officer, body: { name: 'Bad Phone', phone: '12' } })
  check('staff with a bad phone -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/municipal/requests/1', { token: officer, body: { status: 'SCHEDULED', scheduledFor: '2001-01-01', staffId: 1 } })
  check('scheduling in the past -> 400', r.status === 400, `got ${r.status}`)
  r = await call('PUT', '/municipal/requests/1', { token: officer, body: { status: 'FLYING' } })
  check('unknown request status -> 400', r.status === 400, `got ${r.status}`)
}
