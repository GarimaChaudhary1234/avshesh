// Municipal collection workers (role FIELD_STAFF): created with a login by the ward officer, they see only the
// pickups assigned to them and report each one collected or not collected.
import { call, check, group, login, newPhone, register } from './harness.mjs'

const tomorrow = () => new Date(Date.now() + 86400_000).toISOString().slice(0, 10)

export async function staff(ctx) {
  const { officer, otherOfficer, commissioner, household, dealer } = ctx.tokens

  group('Giving a collection worker a login')
  const phone = newPhone()
  let r = await call('POST', '/municipal/staff', { token: officer, body: { name: 'QA Field Worker', phone, password: 'secret12' } })
  check('the ward officer creates a worker with a login', r.status === 200 && r.json?.hasLogin === true && r.json?.phone === phone, `${r.status} ${r.text}`)
  const worker = r.json
  r = await call('POST', '/municipal/staff', { token: officer, body: { name: 'Same Phone', phone, password: 'secret12' } })
  check('a phone number that already has an account is refused (409)', r.status === 409, `got ${r.status} ${r.text}`)
  r = await call('POST', '/municipal/staff', { token: officer, body: { name: 'No Password', phone: newPhone() } })
  check('a worker needs a first password (400)', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/municipal/staff', { token: officer, body: { name: 'Short', phone: newPhone(), password: '123' } })
  check('a short password is refused (400)', r.status === 400, `got ${r.status}`)
  r = await call('POST', '/municipal/staff', { token: commissioner, body: { name: 'By Commissioner', phone: newPhone(), password: 'secret12' } })
  check('the commissioner does not create workers (they belong to a ward officer)', r.status === 400, `got ${r.status} ${r.text}`)

  const me = await login(phone, 'secret12')
  check('the worker logs in with that phone number as a FIELD_STAFF', me.user.role === 'FIELD_STAFF' && me.user.phoneVerified === true && me.user.wardId === 15, JSON.stringify(me.user))
  const token = me.token
  r = await call('POST', '/auth/register', { body: { phone: newPhone(), name: 'Sneaky', password: 'secret12', role: 'FIELD_STAFF' } })
  check('nobody can register themselves as a collection worker (403)', r.status === 403, `got ${r.status}`)

  group('What a worker can and cannot reach')
  r = await call('GET', '/staff/tasks', { token })
  check('a new worker has nothing assigned', r.status === 200 && r.json?.open?.length === 0 && r.json?.done?.length === 0, r.text)
  for (const [method, path, body] of [['GET', '/home'], ['GET', '/collector/pools'], ['GET', '/municipal/overview'], ['GET', '/municipal/wards'], ['GET', '/municipal/requests'], ['POST', '/listings', { itemCode: 'NEWSPAPER', estKg: 1, mode: 'POOL' }], ['PUT', '/municipal/requests/1', { status: 'REJECTED' }]]) {
    r = await call(method, path, { token, body })
    check(`a worker cannot ${method} ${path} (403)`, r.status === 403, `got ${r.status}`)
  }
  for (const [who, t] of [['a household', household], ['a dealer', dealer], ['a ward officer', officer], ['the commissioner', commissioner]]) {
    r = await call('GET', '/staff/tasks', { token: t })
    check(`${who} cannot open the worker screen (403)`, r.status === 403, `got ${r.status}`)
  }
  r = await call('PUT', '/me/location', { token, body: { lat: 20.3, lng: 85.8 } })
  check('a worker cannot move their location (403)', r.status === 403 && r.json?.code === 'LOCATION_NOT_ALLOWED', r.text)
  r = await call('GET', '/me/ward', { token })
  check('a worker\'s ward is known', r.json?.id === 15, r.text)

  group('The pickup, from request to collected')
  const home = await register('HOUSEHOLD', { name: 'QA Staff Household' })
  r = await call('POST', '/municipal-requests', { token: home.token, body: { itemCode: 'DUST_SWEEPINGS', estKg: 4, note: 'Behind the gate' } })
  check('a household asks for a municipal pickup', r.status === 200, r.text)
  const requestId = r.json.id
  r = await call('PUT', `/municipal/requests/${requestId}`, { token: officer, body: { status: 'SCHEDULED', scheduledFor: tomorrow(), staffId: worker.id } })
  check('the officer assigns it to the worker', r.status === 200 && r.json?.staffId === worker.id, r.text)

  r = await call('GET', '/staff/tasks', { token })
  const task = r.json?.open?.find((x) => x.requestId === requestId)
  check('the worker sees it with the household, phone, place, item and note', task && task.householdName === 'QA Staff Household' && task.householdPhone === home.phone && typeof task.lat === 'number' && task.note === 'Behind the gate' && task.itemName, JSON.stringify(r.json))

  const other = await call('POST', '/municipal/staff', { token: officer, body: { name: 'QA Other Worker', phone: newPhone(), password: 'secret12' } })
  const otherLogin = await login(other.json.phone, 'secret12')
  r = await call('GET', '/staff/tasks', { token: otherLogin.token })
  check('another worker does not see it', r.json?.open?.length === 0, r.text)
  r = await call('POST', `/staff/tasks/${requestId}/collected`, { token: otherLogin.token })
  check('and cannot mark it collected (404 TASK_NOT_FOUND)', r.status === 404 && r.json?.code === 'TASK_NOT_FOUND', `${r.status} ${r.text}`)

  r = await call('POST', `/staff/tasks/${requestId}/problem`, { token, body: { reason: '' } })
  check('"could not collect" needs a reason (400)', r.status === 400, `got ${r.status}`)
  r = await call('POST', `/staff/tasks/${requestId}/problem`, { token, body: { reason: 'Nobody was home' } })
  check('the worker reports a problem: the task leaves their list', r.status === 200 && r.json?.open?.length === 0, r.text)
  let queue = (await call('GET', '/municipal/requests', { token: officer })).json.find((x) => x.id === requestId)
  check('the request is open again and unassigned for the officer', queue?.status === 'OPEN' && queue?.staffId === null, JSON.stringify(queue))
  let inbox = (await call('GET', '/me/notifications', { token: home.token })).json
  check('the household is told it will be scheduled again', inbox.items.some((n) => n.code === 'municipal.problem'), JSON.stringify(inbox.items.map((n) => n.code)))

  r = await call('PUT', `/municipal/requests/${requestId}`, { token: officer, body: { status: 'SCHEDULED', scheduledFor: tomorrow(), staffId: worker.id } })
  r = await call('POST', `/staff/tasks/${requestId}/collected`, { token })
  check('after it is scheduled again the worker marks it collected', r.status === 200 && r.json?.open?.length === 0 && r.json?.done?.some((x) => x.requestId === requestId), r.text)
  queue = (await call('GET', '/municipal/requests', { token: officer })).json.find((x) => x.id === requestId)
  check('the officer sees it as COLLECTED', queue?.status === 'COLLECTED', JSON.stringify(queue))
  inbox = (await call('GET', '/me/notifications', { token: home.token })).json
  check('the household is told it was collected', inbox.items.some((n) => n.code === 'municipal.collected'), JSON.stringify(inbox.items.map((n) => n.code)))
  r = await call('POST', `/staff/tasks/${requestId}/collected`, { token })
  check('a pickup cannot be collected twice (404)', r.status === 404, `got ${r.status}`)
  const feed = (await call('GET', '/municipal/activity', { token: officer })).json
  check('the worker\'s actions are in the ward activity, under their name', feed.some((a) => a.code === 'REQUEST_COLLECTED' && a.actorName === 'QA Field Worker') && feed.some((a) => a.code === 'REQUEST_PROBLEM' && a.detail.includes('Nobody was home')), JSON.stringify(feed.slice(0, 4)))

  group('Switching a worker off')
  r = await call('PUT', `/municipal/staff/${worker.id}`, { token: otherOfficer, body: { active: false } })
  check('the officer of another ward cannot switch the worker off (403)', r.status === 403, `got ${r.status}`)
  r = await call('PUT', `/municipal/staff/${worker.id}`, { token: officer, body: { active: false } })
  check('the ward officer switches the worker off', r.status === 200 && r.json?.active === false, r.text)
  const attempt = await call('POST', '/auth/login', { body: { phone, password: 'secret12' } })
  check('the worker can no longer log in (AUTH_ACCOUNT_DISABLED)', attempt.status === 401 && attempt.json?.code === 'AUTH_ACCOUNT_DISABLED', attempt.text)
  r = await call('PUT', `/municipal/requests/${requestId}`, { token: officer, body: { status: 'SCHEDULED', scheduledFor: tomorrow(), staffId: worker.id } })
  check('a switched-off worker cannot be assigned work (400)', r.status === 400, `got ${r.status} ${r.text}`)
  r = await call('PUT', `/municipal/staff/${worker.id}`, { token: officer, body: { active: true } })
  const back = await call('POST', '/auth/login', { body: { phone, password: 'secret12' } })
  check('switching back on restores the login', r.status === 200 && back.status === 200, `${r.status} ${back.status}`)

  group('The commissioner sees workers per ward')
  r = await call('GET', '/municipal/wards/15', { token: commissioner })
  check('the ward page lists the workers and whether they have a login', r.json?.staff?.some((s) => s.name === 'QA Field Worker' && s.hasLogin === true), JSON.stringify(r.json?.staff))
  const seeded = (await call('GET', '/municipal/staff', { token: officer })).json.find((s) => s.phone === '9000000301')
  check('the demo workers have a login too', seeded?.hasLogin === true, JSON.stringify(seeded))
}
