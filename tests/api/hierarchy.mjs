// The municipal hierarchy: commissioner (whole city) > ward officers (one ward each) > the ward's collection staff.
// Runs after the other checks on the same fresh database (it changes officers, so it goes last among the municipal tests).
import { call, check, group, login, newPhone, sleep } from './harness.mjs'

export async function hierarchy(ctx) {
  const { commissioner, officer, otherOfficer, household, dealer } = ctx.tokens

  group('Commissioner: all wards at a glance')
  let r = await call('GET', '/municipal/wards', { token: commissioner })
  check('the commissioner gets every ward with a summary', r.status === 200 && r.json?.summary?.wards >= 60 && r.json?.wards?.length === r.json?.summary?.wards, `${r.status} ${r.text.slice(0, 200)}`)
  const ward15 = r.json?.wards?.find((w) => w.ward.id === 15)
  check('each ward row has households, dealers, open requests, disputes and its officers', ward15 && typeof ward15.registeredHouseholds === 'number' && ward15.registeredHouseholds >= 7 && ward15.dealers >= 2 && typeof ward15.openRequests === 'number' && typeof ward15.openDisputes === 'number' && ward15.officers.some((o) => o.name.includes('Ward Officer')), JSON.stringify(ward15))
  check('the city summary adds the wards up', r.json.summary.registeredHouseholds === r.json.wards.reduce((a, w) => a + w.registeredHouseholds, 0) && r.json.summary.officialHouseholds > 100000, JSON.stringify(r.json.summary))
  check('wards without an officer are visible too (so the commissioner can fill them)', r.json.wards.some((w) => w.officers.length === 0), '')

  group('Handling requests is the ward officer\'s job')
  r = await call('PUT', '/municipal/requests/1', { token: commissioner, body: { status: 'REJECTED' } })
  check('the commissioner cannot assign, schedule or reject a request (403 WARD_OFFICER_ONLY)', r.status === 403 && r.json?.code === 'WARD_OFFICER_ONLY', `${r.status} ${r.text}`)

  group('Only the commissioner may use the city screens')
  for (const [who, token] of [['a ward officer', officer], ['the officer of another ward', otherOfficer], ['a household', household], ['a dealer', dealer]]) {
    for (const [method, path, body] of [['GET', '/municipal/wards'], ['GET', '/municipal/wards/15'], ['GET', '/municipal/officers'], ['POST', '/municipal/officers', { name: 'X', phone: '9999999991', password: 'secret12', wardId: 15 }]]) {
      r = await call(method, path, { token, body })
      check(`${who} cannot ${method} ${path} (403)`, r.status === 403, `got ${r.status} ${r.text.slice(0, 100)}`)
    }
  }
  r = await call('GET', '/municipal/wards', { token: officer })
  check('the refusal for a ward officer names the reason', r.json?.code === 'COMMISSIONER_ONLY', r.text)

  group('One ward in depth')
  r = await call('GET', '/municipal/wards/15', { token: commissioner })
  check('ward 15: its officer, staff, dealers and activity', r.status === 200 && r.json?.officers?.length >= 1 && r.json?.staff?.length >= 2 && r.json?.dealers?.length >= 2 && r.json?.activity?.some((a) => a.code === 'STAFF_ADDED'), `${r.status} ${r.text.slice(0, 300)}`)
  check('the officer row shows what they did', r.json?.officers?.[0]?.actions >= 1 && r.json.officers[0].lastActionAt, JSON.stringify(r.json?.officers))
  r = await call('GET', '/municipal/wards/999999', { token: commissioner })
  check('an unknown ward is a 404', r.status === 404, `got ${r.status}`)

  group('Creating, moving and switching off ward officers')
  const phone = newPhone()
  r = await call('POST', '/municipal/officers', { token: commissioner, body: { name: 'New Officer QA', phone, password: 'secret12', wardId: 30 } })
  const created = r.json?.find?.((o) => o.phone === phone)
  check('the commissioner creates an officer for ward 30', r.status === 200 && created?.wardId === 30 && created?.active === true, `${r.status} ${r.text.slice(0, 200)}`)
  r = await call('POST', '/municipal/officers', { token: commissioner, body: { name: 'Same Phone', phone, password: 'secret12', wardId: 30 } })
  check('a phone number that already has an account is refused (409)', r.status === 409, `got ${r.status}`)
  r = await call('POST', '/municipal/officers', { token: commissioner, body: { name: 'No Ward', phone: newPhone(), password: 'secret12', wardId: 999999 } })
  check('an unknown ward is refused (400 WARD_UNKNOWN)', r.status === 400 && r.json?.code === 'WARD_UNKNOWN', r.text)
  r = await call('POST', '/municipal/officers', { token: commissioner, body: { name: 'Weak', phone: newPhone(), password: '123', wardId: 30 } })
  check('a short password is refused', r.status === 400, `got ${r.status}`)

  const mine = await login(phone, 'secret12')
  r = await call('GET', '/municipal/overview', { token: mine.token })
  check('the new officer sees ward 30 only', r.status === 200 && r.json?.ward?.id === 30, r.text.slice(0, 200))
  r = await call('GET', '/me/ward', { token: mine.token })
  check('/me/ward tells the officer their ward', r.json?.id === 30, r.text)
  const ramesh = (await call('GET', '/municipal/collectors', { token: officer })).json.find((c) => c.phone === '9000000101')
  r = await call('POST', `/municipal/collectors/${ramesh.id}/verification`, { token: mine.token, body: { status: 'VERIFIED' } })
  check('and cannot touch a dealer of ward 15 (403)', r.status === 403 && r.json?.code === 'WARD_FORBIDDEN', `${r.status} ${r.text}`)

  r = await call('PUT', `/municipal/officers/${created.id}`, { token: commissioner, body: { wardId: 15 } })
  check('the commissioner moves the officer to ward 15', r.status === 200 && r.json.find((o) => o.id === created.id)?.wardId === 15, `${r.status} ${r.text.slice(0, 200)}`)
  r = await call('GET', '/municipal/collectors', { token: mine.token })
  check('the same login now works on ward 15 at once (permissions follow the account)', r.status === 200 && r.json.some((c) => c.phone === '9000000101'), r.text.slice(0, 200))

  r = await call('POST', '/municipal/staff', { token: mine.token, body: { name: 'QA Collector', phone: '9000000399', password: 'secret12' } })
  check('the moved officer adds a collection worker to ward 15', r.status === 200, `${r.status} ${r.text}`)

  group('What officers did is recorded')
  r = await call('GET', '/municipal/activity', { token: officer })
  check('the ward 15 officer sees the new colleague\'s action', r.json?.some((a) => a.code === 'STAFF_ADDED' && a.detail === 'QA Collector' && a.actorName === 'New Officer QA'), r.text.slice(0, 300))
  check('and the move itself', r.json?.some((a) => a.code === 'OFFICER_MOVED'), r.text.slice(0, 300))
  r = await call('GET', '/municipal/activity?wardId=15', { token: officer })
  check('a ward officer cannot ask for another ward\'s activity: the filter is ignored', r.json?.every((a) => a.wardId === 15), '')
  r = await call('GET', '/municipal/activity', { token: otherOfficer })
  check('the officer of another ward does not see it', !r.json?.some((a) => a.detail === 'QA Collector'), r.text.slice(0, 200))
  r = await call('GET', '/municipal/activity', { token: commissioner })
  check('the commissioner sees activity of every ward', r.json?.some((a) => a.detail === 'QA Collector') && r.json?.some((a) => a.wardId !== 15), r.text.slice(0, 200))
  r = await call('GET', '/municipal/wards/15', { token: commissioner })
  check('and the ward page lists it', r.json?.activity?.some((a) => a.detail === 'QA Collector'), '')

  group('Switching an officer off')
  r = await call('PUT', `/municipal/officers/${created.id}`, { token: commissioner, body: { active: false } })
  check('the commissioner switches the officer off', r.status === 200 && r.json.find((o) => o.id === created.id)?.active === false, r.text.slice(0, 200))
  let attempt = await call('POST', '/auth/login', { body: { phone, password: 'secret12' } })
  check('a switched-off officer cannot log in (AUTH_ACCOUNT_DISABLED)', attempt.status === 401 && attempt.json?.code === 'AUTH_ACCOUNT_DISABLED', attempt.text)
  attempt = await call('POST', '/auth/login', { body: { phone, password: 'wrong-password' } })
  check('a wrong password still looks like any other failed login', attempt.json?.code === 'AUTH_INVALID_CREDENTIALS', attempt.text)
  await sleep(6500)
  r = await call('GET', '/municipal/overview', { token: mine.token })
  check('the token they already had stops working within seconds (401)', r.status === 401, `got ${r.status}`)
  r = await call('PUT', `/municipal/officers/${created.id}`, { token: commissioner, body: { active: true } })
  attempt = await call('POST', '/auth/login', { body: { phone, password: 'secret12' } })
  check('switching them back on lets them log in again', r.status === 200 && attempt.status === 200, `${r.status} ${attempt.status}`)

  group('Only ward officers are managed')
  const commissionerId = (await login('9000000200')).user.id
  r = await call('PUT', `/municipal/officers/${commissionerId}`, { token: commissioner, body: { active: false } })
  check('the commissioner account cannot be switched off through the officer list (404)', r.status === 404, `got ${r.status}`)
  r = await call('GET', '/me/ward', { token: commissioner })
  check('the commissioner has no ward', r.status === 200 && (r.json === null || r.text === ''), r.text)
  r = await call('GET', '/me/ward', { token: household })
  check('a household sees its own ward', r.json?.id === 15, r.text)
}
