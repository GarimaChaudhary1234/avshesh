// The three main user journeys, clicked through in a real browser.
// Needs a freshly seeded stack running with the mock scanner:
//   docker compose down -v && SCANNER=mock docker compose up -d
import {
  APP, DEMO, loginWithButton, loginWithPhone, logout, nav, open, report, scanMock, shot, stepper,
} from './lib.mjs'

export async function journeys() {
  let failures = 0

  // ---------- 1. household -> pool -> dealer -> payment
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    await step('logged-out visitor lands on the login page', async () => {
      await page.goto(APP)
      await page.getByRole('heading', { name: 'Avshesh' }).waitFor({ timeout: 8000 })
    })
    await step('household logs in and sees the home screen', async () => {
      await loginWithButton(page, DEMO.household.label)
      await page.getByText('Scan Waste').first().waitFor()
      await page.getByText('Ward 15 · South-West Zone, Bhubaneswar').waitFor()
    })
    await step('hazardous waste shows the alert and nearby drop-off points', async () => {
      await scanMock(page, 'Battery')
      await page.getByText(/Hazardous: do not give this to a scrap dealer/).waitFor()
      await page.getByText('Ward Office Drop-off Point').waitFor()
    })
    await step('a plastic bottle listing joins the neighbours\' pool', async () => {
      await nav(page, /Home/).click()
      await scanMock(page, 'Plastic Bottle (PET)')
      await page.getByRole('button', { name: /Create listing/ }).click()
      await page.getByLabel(/Weight/).fill('5')
      await page.getByRole('button', { name: 'Submit listing' }).click()
      await page.getByText('Your neighbourhood pool').waitFor()
    })
    await step('a second listing makes the pool ready', async () => {
      await scanMock(page, 'Newspaper / Waste Paper')
      await page.getByRole('button', { name: /Create listing/ }).click()
      await page.getByLabel(/Weight/).fill('8')
      await page.getByRole('button', { name: 'Submit listing' }).click()
      await page.getByText('The pool is ready').waitFor()
    })
    await logout(page)
    await step('the scrap dealer accepts the pool and gets a route', async () => {
      await loginWithButton(page, DEMO.dealer.label)
      await page.getByRole('button', { name: 'Accept' }).first().click()
      await page.getByRole('button', { name: 'Confirm pickup' }).click()
      await page.getByText('Pickup route').waitFor()
    })
    await logout(page)
    await step('the household sees the confirmed pickup time and no code to show', async () => {
      await loginWithButton(page, DEMO.household.label)
      await nav(page, /My Listings/).click()
      const card = page.locator('div.rounded-2xl', { hasText: 'Plastic Bottle' })
      await card.getByText(/Pickup confirmed!/).waitFor()
      if (await card.getByText(/OTP/).count()) throw new Error('an OTP is still shown')
    })
    await logout(page)
    await step('the dealer sees the route on a map, where to go and who to call, and completes the stop with weight and payment', async () => {
      await loginWithButton(page, DEMO.dealer.label)
      await nav(page, /Pickups/).click()
      await page.locator('.leaflet-container').first().waitFor()
      const stop = page.locator('li', { hasText: 'Garima' }).filter({ hasText: 'Plastic Bottle (PET)' })
      await page.getByRole('link', { name: /Navigate the whole route/ }).first().waitFor()
      await stop.getByRole('link', { name: /Navigate$/ }).waitFor()
      await stop.getByRole('link', { name: /9000000001/ }).waitFor()
      await stop.getByRole('button', { name: 'Collect' }).click()
      if (await stop.getByLabel(/OTP/).count()) throw new Error('the form still asks for an OTP')
      await stop.getByLabel('Actual weight (kg)').fill('5.4')
      await stop.getByRole('button', { name: 'Done' }).click()
      await stop.getByText(/received/).waitFor()
    })
    await step('earnings and the public impact page show the result', async () => {
      await nav(page, /Earnings/).click()
      await page.getByText(/Last 7 days/).waitFor()
      await page.goto(`${APP}/impact`)
      await page.getByText('Diverted from landfill', { exact: true }).waitFor()
    })
    await shot(page, 'journey-1-done')
    failures += report('Journey 1: household, pool, dealer, payment', problems, steps)
    await close()
  }

  // ---------- 2. municipal: general waste request, verification, drop-off point, dealer pause
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    await step('an unverified dealer sees the pending banner', async () => {
      await loginWithPhone(page, DEMO.pending.phone)
      await page.getByText('Waiting for municipal verification').waitFor()
    })
    await logout(page)
    await step('general waste becomes a municipal pickup request', async () => {
      await loginWithButton(page, DEMO.household.label)
      await scanMock(page, 'Dust / Sweepings')
      await page.getByLabel(/Weight/).fill('3')
      await page.getByRole('button', { name: /Request municipal pickup/ }).click()
      await page.getByText('Request sent to the municipal corporation').waitFor()
    })
    await logout(page)
    await step('the ward officer assigns staff and schedules the request', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await page.getByText('Needs your attention').waitFor()
      await nav(page, /Requests/).click()
      const card = page.locator('div.rounded-2xl', { hasText: 'Dust / Sweepings' }).filter({ hasText: 'Open' }).first()
      await card.getByRole('combobox').selectOption({ label: 'Mahesh Behera' })
      await card.getByRole('button', { name: 'Assign and schedule' }).click()
      await page.getByText('Scheduled', { exact: true }).first().waitFor()
    })
    await step('the officer verifies the pending dealer', async () => {
      await nav(page, /Dealers/).click()
      const kishan = page.locator('div.rounded-2xl', { hasText: 'Kishan Scrap Mart' })
      await kishan.getByRole('button', { name: 'Verify', exact: true }).click()
      await kishan.getByText('Verified').waitFor()
    })
    await step('the officer adds a drop-off point inside the ward', async () => {
      await nav(page, /Drop-offs/).click()
      await page.getByLabel('Name').fill('Test Point')
      await page.getByLabel('Address').fill('Test Road')
      await page.getByLabel('What it accepts').fill('Batteries')
      await page.getByRole('button', { name: 'Add drop-off point' }).click()
      await page.getByText('Test Point').waitFor()
    })
    await logout(page)
    await step('the verified dealer can pause pickups from the profile', async () => {
      await loginWithPhone(page, DEMO.pending.phone)
      await nav(page, /Profile/).click()
      await page.getByText('✅ Verified').waitFor()
      await page.getByLabel(/Accepting pickups/).uncheck()
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.getByText('✅ Saved').waitFor()
      await nav(page, /Pools/).click()
      await page.getByText('You are paused').waitFor()
    })
    await logout(page)
    await step('the household sees the scheduled municipal pickup with staff name', async () => {
      await loginWithButton(page, DEMO.household.label)
      await nav(page, /My Listings/).click()
      await page.getByText('Pickup scheduled').waitFor()
      await page.getByText('Mahesh Behera').waitFor()
    })
    await shot(page, 'journey-2-done')
    failures += report('Journey 2: municipal requests, verification, drop-off points', problems, steps)
    await close()
  }

  // ---------- 3. ratings and ward isolation (uses the pickup completed in journey 1)
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    await step('the household rates the completed pickup', async () => {
      await loginWithButton(page, DEMO.household.label)
      await nav(page, /My Listings/).click()
      // The demo household also has an older, seeded compost pickup: rate the plastic bottle pickup of this journey.
      const card = page.locator('div.rounded-2xl', { hasText: 'Plastic Bottle (PET)' }).filter({ hasText: 'How was the pickup?' }).last()
      await card.waitFor()
      await card.getByRole('radio', { name: '5 stars' }).click()
      await card.getByPlaceholder('Add a comment (optional)').fill('Fair weighing, on time')
      await card.getByRole('button', { name: 'Submit rating' }).click()
      await page.locator('div.rounded-2xl', { hasText: 'Plastic Bottle (PET)' }).filter({ hasText: /You rated this pickup/ }).first().waitFor()
    })
    await logout(page)
    await step('the dealer sees the rating and comment', async () => {
      await loginWithButton(page, DEMO.dealer.label)
      await nav(page, /Profile/).click()
      await page.getByText('Fair weighing, on time').waitFor()
    })
    await logout(page)
    await step('the ward officer manages staff and sees the dealer rating', async () => {
      await loginWithButton(page, DEMO.officer.label)
      await nav(page, /Staff/).click()
      await page.getByLabel('Name').fill('Test Worker')
      await page.getByLabel('Phone number').fill('9876543210')
      await page.getByLabel('First password').fill('secret12')
      await page.getByRole('button', { name: 'Add staff member' }).click()
      await page.getByText('Test Worker').waitFor()
      await nav(page, /Dealers/).click()
      await page.locator('div.rounded-2xl', { hasText: 'Ramesh Scrap Traders' }).getByText('5.0').waitFor()
    })
    await logout(page)
    await step('the officer of another ward sees none of ward 15', async () => {
      await loginWithPhone(page, DEMO.otherOfficer.phone)
      await page.getByText('Ward 1 · North Zone, Bhubaneswar').first().waitFor()
      await nav(page, /Requests/).click()
      await page.getByText('No requests yet.').waitFor()
      await nav(page, /Dealers/).click()
      await page.waitForTimeout(400)
      if (await page.getByText('Ramesh Scrap Traders').count()) throw new Error('ward 15 dealer visible')
    })
    await logout(page)
    await step('the commissioner sees the whole city and cannot add staff', async () => {
      await loginWithButton(page, DEMO.commissioner.label)
      await page.getByText('City overview').waitFor()
      await page.goto(`${APP}/staff`)
      await page.getByText('Staff are added by the officer of each ward.').waitFor()
    })
    failures += report('Journey 3: ratings and ward isolation', problems, steps)
    await close()
  }
  return failures
}
