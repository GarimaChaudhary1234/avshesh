// Browser checks for the second round of features: languages, phone proof, password reset, payment disputes,
// notifications, cookie login and the installable/offline app. Runs after the main journeys on the same stack
// (it needs the completed pickup that the first journey leaves for the demo household).
import {
  APP, DEMO, loginWithButton, loginWithPhone, logout, nav, open, report, scanMock, stepper, verifyInBrowser,
} from './lib.mjs'

let counter = 0
const newPhone = () => `97${String(Date.now()).slice(-6)}${String(++counter).padStart(2, '0')}`

async function registerHousehold(page, phone, password = 'secret12') {
  await page.goto(`${APP}/register`)
  await page.getByLabel('Name').fill('Browser Tester')
  await page.getByLabel('Phone number').fill(phone)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Register', exact: true }).click()
}

export async function phase2() {
  let failures = 0

  // ---------- languages
  {
    const { page, problems, close, allow } = await open()
    allow(401, '/auth/login') // the deliberate wrong-password request below
    const { steps, step } = stepper()
    await step('the login page can be switched to Hindi and Odia, and the choice survives a reload', async () => {
      await page.goto(`${APP}/login`)
      await page.getByLabel('Language').selectOption({ label: 'हिन्दी' })
      await page.getByRole('button', { name: 'लॉगिन', exact: true }).waitFor()
      if ((await page.evaluate(() => document.documentElement.lang)) !== 'hi') throw new Error('html lang is not hi')
      await page.reload()
      await page.getByRole('button', { name: 'लॉगिन', exact: true }).waitFor()
      await page.getByLabel('भाषा').selectOption({ label: 'ଓଡ଼ିଆ' })
      await page.getByRole('button', { name: 'ଲଗଇନ୍', exact: true }).waitFor()
    })
    await step('a logged-in household sees the whole app in Hindi, and the language is saved on the account', async () => {
      await page.getByLabel('ଭାଷା').selectOption({ label: 'हिन्दी' })
      await page.getByLabel('फ़ोन नंबर').fill(DEMO.household.phone)
      await page.getByLabel('पासवर्ड').fill('demo1234')
      await page.getByRole('button', { name: 'लॉगिन', exact: true }).click()
      await page.getByRole('navigation').getByText('मेरी लिस्टिंग').waitFor()
      await nav(page, /मेरी लिस्टिंग/).click()
      await page.locator('main').waitFor()
      const me = await page.evaluate(async () => (await fetch('/api/v1/me')).json())
      if (me.language !== 'hi') throw new Error(`account language is ${me.language}`)
    })
    await step('server errors come back in Hindi', async () => {
      const err = await page.evaluate(async () => {
        const r = await fetch('/api/v1/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'hi' },
          body: JSON.stringify({ phone: '9000000001', password: 'wrong-password' }),
        })
        return (await r.json()).error
      })
      if (!/[ऀ-ॿ]/.test(err ?? '')) throw new Error(`not Hindi: ${err}`)
    })
    await step('switching back to English restores the English screens', async () => {
      await page.getByLabel('भाषा').selectOption({ label: 'English' })
      await page.getByRole('navigation').getByText('My Listings').waitFor()
    })
    await step("log out", () => logout(page))
    failures += report('Phase 2, languages', problems, steps)
    await close()
  }

  // ---------- phone proof and password reset
  {
    const { page, problems, close, allow } = await open()
    const { steps, step } = stepper()
    const phone = newPhone()
    await step('a new account is sent to verify its phone number', async () => {
      await registerHousehold(page, phone)
      await page.getByRole('heading', { name: 'Verify your phone number' }).waitFor()
      await page.getByText('Verify your phone number to continue').first().waitFor()
    })
    await step('an unverified household cannot scan: it is asked to verify instead', async () => {
      await nav(page, /Scan/).click()
      await page.getByRole('link', { name: /Verify/ }).first().waitFor()
      if (await page.locator('input[type=file]').count()) throw new Error('the scan form is still shown')
    })
    let code
    await step('the code is sent and a wrong code is refused', async () => {
      await page.goto(`${APP}/verify`)
      await page.getByRole('button', { name: 'Send code' }).click()
      const text = await page.getByText(/Your code is \d{6}/).innerText()
      code = text.match(/\d{6}/)[0]
      allow(400, '/me/phone/verify')
      await page.getByLabel('6-digit code').fill(code === '000000' ? '111111' : '000000')
      await page.getByRole('button', { name: 'Verify', exact: true }).click()
      await page.getByRole('alert').waitFor()
    })
    await step('the right code verifies the phone and the banner disappears', async () => {
      await page.getByLabel('6-digit code').fill(code)
      await page.getByRole('button', { name: 'Verify', exact: true }).click()
      await page.getByText('Your phone number is verified.').waitFor()
      await page.getByRole('link', { name: 'Continue' }).click()
      await page.getByText('Scan Waste').first().waitFor()
      if (await page.getByText('Verify your phone number to continue').count()) throw new Error('banner still visible')
    })
    await step('the login token is not readable from JavaScript', async () => {
      const seen = await page.evaluate(() => ({ cookie: document.cookie, ls: JSON.stringify({ ...localStorage }) }))
      if (/avshesh_token/.test(seen.cookie)) throw new Error('token cookie is visible to scripts')
      if (/"token"|eyJ/.test(seen.ls)) throw new Error('a token is stored in localStorage')
      const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('avshesh.user')))
      if (stored.phone !== phone) throw new Error('profile not stored')
    })
    await step("log out", () => logout(page))
    await step('a forgotten password can be reset with an SMS code', async () => {
      await page.goto(`${APP}/login`)
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await page.getByLabel('Phone number').fill(phone)
      await page.getByRole('button', { name: 'Send code' }).click()
      const text = await page.getByText(/Your code is \d{6}/).innerText({ timeout: 10000 }).catch(async () => {
        // say what the page showed instead (an error from the server, for example)
        throw new Error('no code on screen: ' + (await page.locator('body').innerText()).slice(0, 300).split('\n').join(' | '))
      })
      await page.getByLabel('6-digit code').fill(text.match(/\d{6}/)[0])
      await page.getByLabel('New password').fill('newsecret9')
      await page.getByRole('button', { name: 'Set new password' }).click()
      await page.getByText('Password changed. You can log in now.').waitFor()
    })
    await step('the new password logs in', async () => {
      await loginWithPhone(page, phone, 'newsecret9')
      await page.getByText('Scan Waste').first().waitFor()
    })
    await step("log out", () => logout(page))
    failures += report('Phase 2, phone proof, cookie login and password reset', problems, steps)
    await close()
  }

  // ---------- payment confirmation, dispute, resolution, notifications
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    await step('the household is asked whether the money arrived', async () => {
      await loginWithButton(page, DEMO.household.label)
      await nav(page, /My Listings/).click()
      await page.getByText(/Did you receive/).first().waitFor()
    })
    await step('"No" needs a note, and then opens a dispute', async () => {
      await page.getByRole('button', { name: 'No, I did not' }).first().click()
      const send = page.getByRole('button', { name: 'Send', exact: true })
      if (await send.isEnabled().catch(() => false)) throw new Error('Send is enabled without a note')
      await page.getByLabel('Tell us briefly what happened (required)').fill('Only half was paid')
      await send.click()
      await page.getByText(/Payment disputed/).first().waitFor()
    })
    await step("log out", () => logout(page))
    await step('the ward officer sees the dispute and resolves it with a note', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await page.getByText(/Payment disputes waiting for review/).waitFor()
      await nav(page, /Requests/).click()
      await page.getByRole('tab', { name: 'Payment disputes' }).click()
      await page.getByText('Only half was paid').waitFor()
      await page.getByLabel('Resolution note').fill('Dealer will refund the difference')
      await page.getByRole('button', { name: 'Mark resolved' }).click()
      await page.getByText('Dispute resolved').first().waitFor()
      await page.getByText('Only half was paid').waitFor({ state: 'detached' })
    })
    await step("log out", () => logout(page))
    await step('the household sees the resolution and has a notification in the inbox', async () => {
      await loginWithButton(page, DEMO.household.label)
      await nav(page, /My Listings/).click()
      await page.getByText('Dispute resolved').first().waitFor()
      await page.getByRole('link', { name: 'Notifications' }).click()
      await page.getByRole('heading', { name: 'Notifications' }).waitFor()
      if ((await page.locator('main .rounded-2xl').count()) === 0) throw new Error('inbox is empty')
    })
    await step("log out", () => logout(page))
    failures += report('Phase 2, payment dispute and notifications', problems, steps)
    await close()
  }

  // ---------- installable app and offline use
  {
    const { page, context, problems, close, allow } = await open()
    allow('ERR_INTERNET_DISCONNECTED') // requests made on purpose while the network is switched off
    const { steps, step } = stepper()
    await step('the app has a web manifest with icons', async () => {
      const m = await (await fetch(`${APP}/manifest.webmanifest`)).json()
      if (m.name !== 'Avshesh' || !m.icons?.some((i) => i.sizes === '512x512')) throw new Error(JSON.stringify(m).slice(0, 200))
      for (const icon of m.icons) {
        const res = await fetch(`${APP}/${icon.src.replace(/^\//, '')}`)
        if (res.status !== 200 || !String(res.headers.get('content-type')).includes('image/png')) throw new Error(`${icon.src}: ${res.status}`)
      }
    })
    await step('a service worker is installed and the app opens with no network', async () => {
      await page.goto(`${APP}/login`)
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.reload() // the worker controls the page from the next load
      await page.evaluate(() => navigator.serviceWorker.ready)
      await context.setOffline(true)
      await page.reload()
      await page.getByRole('heading', { name: 'Avshesh' }).waitFor({ timeout: 8000 })
      await context.setOffline(false)
    })
    await step('private API answers are never put in the offline cache', async () => {
      const urls = await page.evaluate(async () => {
        const out = []
        for (const name of await caches.keys()) for (const req of await (await caches.open(name)).keys()) out.push(req.url)
        return out
      })
      if (urls.length === 0) throw new Error('nothing precached')
      if (urls.some((u) => u.includes('/api/'))) throw new Error(`API cached: ${urls.filter((u) => u.includes('/api/')).join(', ')}`)
    })
    await step('a listing made offline is saved on the phone and sent when the network returns', async () => {
      await loginWithButton(page, DEMO.household.label)
      await page.getByText('Scan Waste').first().waitFor()
      await scanMock(page, 'Cardboard / Cartons')
      await page.getByRole('button', { name: /Create listing/ }).click()
      await page.getByLabel(/Weight/).fill('3')
      await context.setOffline(true)
      await page.getByRole('button', { name: 'Submit listing' }).click()
      await page.getByText(/You are offline\. Your listing is saved on this phone/).first().waitFor()
      const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('avshesh.queue') ?? '[]').length)
      if (queued !== 1) throw new Error(`queue length ${queued}`)
      await context.setOffline(false)
      await page.getByText(/1 saved listing\(s\) sent/).waitFor({ timeout: 15000 })
      const left = await page.evaluate(() => JSON.parse(localStorage.getItem('avshesh.queue') ?? '[]').length)
      if (left !== 0) throw new Error(`queue not emptied: ${left}`)
      await nav(page, /My Listings/).click()
      await page.getByText(/Cardboard/).first().waitFor()
    })
    await step("log out", () => logout(page))
    failures += report('Phase 2, install and offline', problems, steps)
    await close()
  }

  // ---------- share of waste kept out of the dump
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    await step('the household home screen shows the share kept out of the dump, with the estimate wording', async () => {
      await loginWithButton(page, DEMO.household.label)
      await page.getByText('kept out of the dump').waitFor()
      await page.getByText(/This is an estimate/).waitFor()
      await page.getByRole('progressbar').first().waitFor()
    })
    await step('the public impact page shows it too', async () => {
      await page.goto(`${APP}/impact`)
      await page.getByText('kept out of the dump').waitFor()
    })
    await step('the share is also shown in Hindi', async () => {
      await page.getByLabel('Language').selectOption({ label: 'हिन्दी' })
      await page.getByText('डंप में जाने से बचा').waitFor()
      await page.getByLabel('भाषा').selectOption({ label: 'English' })
    })
    await page.goto(APP)
    await step("log out", () => logout(page))
    await step('the officer overview shows the ward share', async () => {
      await page.goto(`${APP}/login`)
      await loginWithButton(page, DEMO.officer.label)
      await page.getByText('kept out of the dump').waitFor()
    })
    await step('log out', () => logout(page))
    failures += report('Phase 2, share of waste kept out of the dump', problems, steps)
    await close()
  }

  // ---------- municipal officers on a desktop screen
  {
    const { page, problems, close } = await open({ viewport: { width: 1280, height: 800 } })
    const { steps, step } = stepper()
    await step('on a wide screen the officer gets a left sidebar and a page that is not stretched', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await page.getByRole('navigation').waitFor()
      const nav = await page.getByRole('navigation').boundingBox()
      const main = await page.locator('main').boundingBox()
      // The whole layout is centred, so compare the two boxes with each other, not with the window edge.
      if (nav.y > 200 || nav.height < 300) throw new Error(`navigation is not a tall sidebar: ${JSON.stringify(nav)}`)
      if (nav.x + nav.width > main.x + 1) throw new Error(`the sidebar is not left of the page: ${JSON.stringify({ nav, main })}`)
      if (main.width > 800) throw new Error(`page is stretched: ${main.width}px`)
    })
    await step('the sidebar links work', async () => {
      await nav(page, /Requests/).click()
      await page.getByRole('tab', { name: 'Payment disputes' }).waitFor()
    })
    await step('on the same screen a household still has the phone layout', async () => {
      await logout(page)
      await loginWithButton(page, DEMO.household.label)
      await page.getByRole('navigation').waitFor()
      const box = await page.getByRole('navigation').boundingBox()
      if (box.y < 500) throw new Error(`household navigation is not at the bottom: ${JSON.stringify(box)}`)
    })
    await step('log out', () => logout(page))
    failures += report('Phase 2, municipal desktop layout', problems, steps)
    await close()
  }

  // ---------- a municipal collection worker logs in and reports pickups
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    const workerPhone = newPhone()
    await step('a ward officer adds a collection worker with a login', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await nav(page, /Staff/).click()
      await page.getByLabel('Name').fill('E2E Worker')
      await page.getByLabel('Phone number').fill(workerPhone)
      await page.getByLabel('First password').fill('secret12')
      await page.getByRole('button', { name: 'Add staff member' }).click()
      await page.getByText('E2E Worker').waitFor()
      await page.getByText(new RegExp(workerPhone + '.*Has a login')).waitFor()
    })
    await step('log out', () => logout(page))
    await step('the new worker logs in, is named as a worker, and has nothing yet', async () => {
      await loginWithPhone(page, workerPhone, 'secret12')
      await page.getByText(/Collection Worker · Ward 15/).first().waitFor()
      await page.getByText('No pickups are assigned to you right now.').waitFor()
      if (await nav(page, /Scan|Pools|Overview/).count()) throw new Error('the worker sees screens of other roles')
    })
    await step('a worker has no way to the officer screens: they are sent home', async () => {
      await page.goto(`${APP}/requests`)
      await page.getByRole('heading', { name: /My pickups/ }).waitFor()
    })
    await step('log out', () => logout(page))
    await step('the demo worker sees the pickup the officer assigned and marks it collected', async () => {
      await loginWithButton(page, DEMO.staff.label)
      await page.getByRole('heading', { name: /My pickups/ }).waitFor()
      // the worker's pickups are on a map too, with one link for the whole round
      await page.locator('.leaflet-container').first().waitFor()
      await page.getByRole('link', { name: /Navigate the whole route/ }).waitFor()
      await page.getByRole('link', { name: /Open the place on the map/ }).first().waitFor()
      await page.getByRole('button', { name: 'Mark collected' }).first().click()
      await page.getByText('Collected in the last 7 days').waitFor()
    })
    await step('log out', () => logout(page))
    await step('the household is told, and the officer sees the worker\'s action in the ward activity', async () => {
      await loginWithButton(page, DEMO.household.label)
      await page.getByRole('link', { name: 'Notifications' }).click()
      await page.getByText('Your waste has been collected by the municipal corporation.').first().waitFor()
      await logout(page)
      await loginWithButton(page, DEMO.officer.label)
      await page.getByText(/Mahesh Behera marked a request collected/).first().waitFor()
    })
    await step('log out', () => logout(page))
    failures += report('Phase 2, municipal collection worker', problems, steps)
    await close()
  }

  // ---------- municipal hierarchy: commissioner > ward officers > collection staff
  {
    const { page, problems, close, allow } = await open({ viewport: { width: 1280, height: 900 } })
    const { steps, step } = stepper()
    const officerPhone = newPhone()
    allow(401, '/auth/login')
    await step('the commissioner is named as such and sees the whole city', async () => {
      await loginWithButton(page, DEMO.commissioner.label)
      await page.getByText('Commissioner (whole city)').first().waitFor()
      await page.getByRole('heading', { name: /City overview/ }).waitFor()
      await page.getByText('Wards that need attention').waitFor()
    })
    await step('the commissioner has no Requests tab (that is the ward officer\'s work) and is sent home from it', async () => {
      if (await nav(page, /Requests/).count()) throw new Error('the commissioner sees a Requests tab')
      await page.goto(`${APP}/requests`)
      await page.getByRole('heading', { name: /City overview/ }).waitFor()
    })
    await step('the wards list opens any ward and shows its officer, staff, dealers and what the officer did', async () => {
      await nav(page, /Wards/).click()
      await page.getByLabel('Search a ward or an officer').fill('Ward 15')
      await page.getByRole('link', { name: /Ward 15 ·/ }).first().click()
      await page.getByRole('heading', { name: /Ward 15 ·/ }).waitFor()
      await page.getByText('Ward Officer (demo)').first().waitFor()
      await page.getByText('Mahesh Behera').first().waitFor()
      await page.getByText('Ramesh Kumar').or(page.getByText('Ramesh Scrap Traders')).first().waitFor()
      await page.getByText(/added a collection worker: Mahesh Behera/).first().waitFor()
    })
    await step('the commissioner creates a ward officer for this ward', async () => {
      await page.getByLabel('Officer name').fill('E2E Officer')
      await page.getByLabel('Phone number (the login)').fill(officerPhone)
      await page.getByLabel('First password').fill('secret12')
      await page.getByRole('button', { name: 'Create officer' }).click()
      await page.getByText('Officer created.').waitFor()
      await page.getByRole('heading', { name: 'E2E Officer' }).waitFor()
    })
    await step('the officers page lists everyone and the commissioner moves the new officer to another ward', async () => {
      await nav(page, /Officers/).click()
      const card = page.locator('div.rounded-2xl', { hasText: 'E2E Officer' }).last()
      await card.waitFor()
      await card.getByLabel('Move to').selectOption({ index: 1 })
      await card.getByRole('button', { name: 'Move officer' }).click()
      await page.waitForTimeout(800)
      const link = await page.locator('div.rounded-2xl', { hasText: 'E2E Officer' }).last().getByRole('link').first().innerText()
      if (/Ward 15 ·/.test(link)) throw new Error(`the officer is still in ward 15: ${link}`)
    })
    await step('the commissioner switches the officer off, and that officer can no longer log in', async () => {
      const card = page.locator('div.rounded-2xl', { hasText: 'E2E Officer' }).last()
      await card.getByRole('button', { name: 'Switch off' }).click()
      await card.getByRole('button', { name: 'Yes, switch off' }).click()
      await card.getByText('Switched off').waitFor()
      await logout(page)
      await loginWithPhone(page, officerPhone, 'secret12')
      await page.getByRole('alert').filter({ hasText: 'switched off' }).waitFor()
    })
    await step('a ward officer is named with the ward, has no city screens, and is sent home from them', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await page.getByText(/Ward Officer · Ward 15/).first().waitFor()
      if (await nav(page, /^🗺️\s*Wards$/).count()) throw new Error('a ward officer sees the Wards tab')
      await page.goto(`${APP}/wards`)
      await page.getByRole('heading', { name: /Ward 15/ }).first().waitFor()
      if (page.url().includes('/wards')) throw new Error('not sent home')
      await page.getByText('Recent activity in your ward').waitFor()
    })
    await step('log out', () => logout(page))
    failures += report('Phase 2, municipal hierarchy', problems, steps)
    await close()
  }

  // ---------- choosing and changing the home location
  {
    const { page, context, problems, close, allow } = await open()
    const { steps, step } = stepper()
    // The tests must not depend on the public map server: every tile is answered with a blank image.
    const blank = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    await context.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: blank }))
    allow(409, '/me/location')
    const ward = () => page.getByRole('status').filter({ hasText: /Ward|outside the wards/ })
    await step('the register page shows a map, finds a place by name and shows its ward', async () => {
      await page.goto(`${APP}/register`)
      await page.locator('.leaflet-container').waitFor()
      await ward().waitFor()
      await page.getByLabel('Search').fill('Patia')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByRole('button', { name: 'Patia, Bhubaneswar, Odisha' }).click()
      await page.waitForTimeout(800)
      await ward().waitFor()
    })
    await step('"Use my location" moves the pin and the ward when the browser allows it', async () => {
      const gps = await context.browser().newContext({
        viewport: { width: 420, height: 1200 }, geolocation: { latitude: 20.2961, longitude: 85.842 }, permissions: ['geolocation'],
      })
      await gps.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: blank }))
      const g = await gps.newPage()
      await g.goto(`${APP}/register`)
      const shown = () => g.getByRole('status').filter({ hasText: /Ward|outside the wards/ })
      await shown().waitFor()
      const before = await shown().innerText()
      await g.getByRole('button', { name: 'Use my location' }).click()
      await g.waitForFunction((was) => [...document.querySelectorAll('[role=status]')].some((el) => /Ward|outside/.test(el.textContent) && el.textContent !== was), before, { timeout: 8000 })
      await gps.close()
    })
    await step('a user in Bengaluru is told the spot is outside, can go back to the demo area, and sees a banner if they stay', async () => {
      const blr = await context.browser().newContext({
        viewport: { width: 420, height: 1200 }, geolocation: { latitude: 12.9716, longitude: 77.5946 }, permissions: ['geolocation'],
      })
      await blr.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: blank }))
      const g = await blr.newPage()
      await g.goto(`${APP}/register`)
      await g.getByRole('button', { name: 'Use my location' }).click()
      await g.getByText('This spot is outside the wards we cover yet').waitFor()
      // staying there: the account works, but the banner says nobody can reach this home yet
      await g.getByLabel('Name').fill('Bengaluru Tester')
      await g.getByLabel('Phone number').fill(newPhone())
      await g.getByLabel('Password').fill('secret12')
      await g.getByRole('button', { name: 'Register', exact: true }).click()
      await verifyInBrowser(g)
      await g.getByText(/outside the wards we serve yet/).waitFor()
      await g.getByRole('link', { name: 'Set my location' }).click()
      await g.getByRole('heading', { name: 'My account' }).waitFor()
      // the way back
      await g.getByRole('button', { name: 'Go to the demo area (Bhubaneswar)' }).click()
      await g.getByRole('status').filter({ hasText: 'Ward 15' }).waitFor()
      await g.getByRole('button', { name: 'Save location' }).click()
      await g.getByText('Location saved. Your ward has been updated.').waitFor()
      await blr.close()
    })
    await step('when location is blocked the user is told why and can still use search or the pin', async () => {
      const blocked = await context.browser().newContext({ viewport: { width: 420, height: 1200 }, permissions: [] })
      await blocked.route('**/tile.openstreetmap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: blank }))
      const g = await blocked.newPage()
      await g.goto(`${APP}/register`)
      await g.getByRole('button', { name: 'Use my location' }).click()
      await g.getByRole('alert').filter({ hasText: 'Location is blocked for this site' }).waitFor()
      await blocked.close()
    })
    await step('pressing Enter in the search box does not submit the registration form', async () => {
      await page.getByLabel('Search').fill('Jaydev')
      await page.getByLabel('Search').press('Enter')
      await page.getByRole('button', { name: /Jaydev Vihar/ }).waitFor()
      if (!page.url().endsWith('/register')) throw new Error('the form was submitted')
    })
    await step('a user registered with a chosen pin can open the account page and move the pin', async () => {
      await page.getByRole('button', { name: /Jaydev Vihar/ }).click()
      await page.getByLabel('Name').fill('Pin Tester')
      await page.getByLabel('Phone number').fill(newPhone())
      await page.getByLabel('Password').fill('secret12')
      await page.getByRole('button', { name: 'Register', exact: true }).click()
      await verifyInBrowser(page)
      await page.getByRole('link', { name: /Pin Tester/ }).click()
      await page.getByRole('heading', { name: 'My account' }).waitFor()
      await page.locator('.leaflet-container').waitFor()
      await page.getByLabel('Search').fill('Saheed')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByRole('button', { name: 'Saheed Nagar, Bhubaneswar, Odisha' }).click()
      await page.getByRole('button', { name: 'Save location' }).click()
      await page.getByText('Location saved. Your ward has been updated.').waitFor()
    })
    await step("log out", () => logout(page))
    await step('a household with an open listing is told it cannot move', async () => {
      await loginWithButton(page, DEMO.household.label)
      await page.getByRole('link', { name: /Garima/ }).click()
      await page.getByLabel('Search').fill('Patia')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByRole('button', { name: 'Patia, Bhubaneswar, Odisha' }).click()
      await page.getByRole('button', { name: 'Save location' }).click()
      await page.getByRole('alert').filter({ hasText: 'cannot change your location' }).waitFor()
    })
    await step("log out", () => logout(page))
    await step('an officer sees that the location of a municipal account is fixed', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await page.getByRole('navigation').waitFor()
      await page.goto(`${APP}/account`)
      await page.getByText('The location of a municipal account is fixed by its ward.').waitFor()
      if (await page.locator('.leaflet-container').count()) throw new Error('officer can see the map picker')
    })
    await step("log out", () => logout(page))
    failures += report('Phase 2, home location', problems, steps)
    await close()
  }

  return failures
}
