// Edge cases a real user hits: sessions, wrong pages, small phones, slow hands, bad networks, accessibility.
import fs from 'node:fs'
import path from 'node:path'
import {
  APP, DEMO, PASSWORD, SHOTS, loginWithButton, loginWithPhone, logout, nav, open, report, scanMock, stepper, verifyInBrowser,
} from './lib.mjs'

const PAGES = {
  household: ['/', '/scan', '/listings'],
  dealer: ['/', '/pickups', '/earnings', '/profile'],
  officer: ['/', '/requests', '/points', '/dealers', '/staff'],
}
const PUBLIC_PAGES = ['/login', '/register', '/impact']

const horizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const unnamedControls = (page) => page.evaluate(() => {
  const bad = []
  const nameOf = (el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title
    || (el.labels && el.labels.length ? el.labels[0].innerText : '') || ''
  document.querySelectorAll('input:not([type=hidden]),select,textarea').forEach((el) => {
    if (!nameOf(el).trim()) bad.push(`${el.tagName.toLowerCase()}[${el.type || ''}] has no label`)
  })
  document.querySelectorAll('button,a').forEach((el) => {
    if (!(el.innerText || '').trim() && !nameOf(el).trim()) bad.push(`${el.tagName.toLowerCase()} has no name`)
  })
  document.querySelectorAll('img').forEach((el) => { if (!el.hasAttribute('alt')) bad.push('img without alt') })
  return bad
})

export async function deep() {
  let failures = 0

  // ---------- sessions and access
  {
    const { page, problems, allow, close } = await open()
    const { steps, step } = stepper()
    allow(401)
    allow(409)

    await step('wrong password shows a clear message', async () => {
      await loginWithPhone(page, DEMO.household.phone, 'not-the-password')
      await page.getByText('Incorrect phone number or password').waitFor()
    })
    await step('pressing Enter in the password field logs in', async () => {
      await page.goto(`${APP}/login`)
      await page.getByLabel('Phone number').fill(DEMO.household.phone)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByLabel('Password').press('Enter')
      await page.getByText('Scan Waste').first().waitFor()
    })
    await step('a page refresh keeps the user logged in', async () => {
      await page.reload()
      await page.getByText('Scan Waste').first().waitFor()
    })
    await step('a household that opens a dealer-only address is sent home, not shown an error', async () => {
      await page.goto(`${APP}/pickups`)
      await page.getByText('Scan Waste').first().waitFor()
    })
    await step('an unknown address does not show a blank page', async () => {
      await page.goto(`${APP}/no/such/page`)
      await page.getByText('Scan Waste').first().waitFor()
    })
    await step('after logout the back button does not reveal the account', async () => {
      await logout(page)
      await page.goBack()
      await page.waitForTimeout(500)
      if (await page.getByText('Scan Waste').count()) throw new Error('still showing the household home')
    })
    await step('a damaged token in the browser sends the user to the login page', async () => {
      await page.goto(`${APP}/login`)
      // The real token is an HttpOnly cookie, so the browser only remembers the user. A stale user without
      // a valid cookie must be sent back to login.
      await page.evaluate(() => localStorage.setItem('avshesh.user', JSON.stringify(
        { id: 1, role: 'HOUSEHOLD', name: 'X', wardId: null, phoneVerified: true, language: 'en' })))
      await page.goto(APP)
      await page.getByRole('heading', { name: 'Avshesh' }).waitFor({ timeout: 8000 })
      const stored = await page.evaluate(() => localStorage.getItem('avshesh.user'))
      if (stored) throw new Error('the bad session was not cleared')
    })
    await step('a dealer who opens a household address is sent to the pools page', async () => {
      await loginWithButton(page, DEMO.dealer.label)
      await page.getByRole('heading', { name: /Pools/ }).waitFor()
      await page.goto(`${APP}/scan`)
      await page.getByRole('heading', { name: /Pools/ }).waitFor()
    })
    await logout(page)
    await step('registering with an existing phone number shows an error', async () => {
      await page.goto(`${APP}/register`)
      await page.getByLabel('Name').fill('Someone')
      await page.getByLabel('Phone number').fill(DEMO.household.phone)
      await page.getByLabel('Password').fill('secret12')
      await page.getByRole('button', { name: 'Register', exact: true }).click()
      await page.getByText('already registered').waitFor()
    })
    failures += report('Deep 1: sessions and access', problems, steps)
    await close()
  }

  // ---------- registering every kind of user through the form
  {
    const { page, problems, close } = await open()
    const { steps, step } = stepper()
    const stamp = String(Date.now()).slice(-7)
    const register = async (role, phone) => {
      await page.goto(`${APP}/register`)
      await page.getByRole('button', { name: role }).click()
      await page.getByLabel('Name').fill(`QA ${role}`)
      await page.getByLabel('Phone number').fill(phone)
      await page.getByLabel('Password').fill('secret12')
      await page.getByRole('button', { name: 'Register', exact: true }).click()
      await verifyInBrowser(page)
    }
    await step('a new household can register and starts on the home screen', async () => {
      await register('🏠 Household', `97${stamp}1`)
      await page.getByText('Scan Waste').first().waitFor()
      await page.getByText('Ward 15').waitFor()
    })
    await logout(page)
    await step('a new scrap dealer starts as pending with no pools', async () => {
      await register('🛺 Scrap Dealer', `97${stamp}2`)
      await page.getByText('Waiting for municipal verification').waitFor()
    })
    await logout(page)
    await step('a new compost center starts as pending', async () => {
      await register('🌱 Compost Center', `97${stamp}3`)
      await page.getByText('Waiting for municipal verification').waitFor()
    })
    await logout(page)
    await step('the register form offers no municipal role', async () => {
      await page.goto(`${APP}/register`)
      if (await page.getByRole('button', { name: /Municipal/ }).count()) throw new Error('municipal role is selectable')
    })
    await step('a short password is blocked before it is sent', async () => {
      await page.getByLabel('Name').fill('Short')
      await page.getByLabel('Phone number').fill(`97${stamp}4`)
      await page.getByLabel('Password').fill('123')
      await page.getByRole('button', { name: 'Register', exact: true }).click()
      await page.waitForTimeout(300)
      if (!page.url().includes('/register')) throw new Error('the form was submitted')
    })
    failures += report('Deep 2: registration', problems, steps)
    await close()
  }

  // ---------- small phone layout and accessibility on every page
  {
    const { page, problems, close } = await open({ viewport: { width: 360, height: 740 } })
    const { steps, step } = stepper()
    const check = async (label, route) => {
      await page.goto(`${APP}${route}`)
      await page.waitForLoadState('networkidle')
      const over = await horizontalOverflow(page)
      if (over > 1) throw new Error(`${label} ${route} scrolls sideways by ${over}px`)
      const bad = await unnamedControls(page)
      if (bad.length) throw new Error(`${label} ${route}: ${bad.join('; ')}`)
    }
    for (const route of PUBLIC_PAGES) {
      await step(`public page ${route} fits a 360 px phone and every control has a name`, () => check('public', route))
    }
    for (const [who, label] of [['household', DEMO.household.label], ['dealer', DEMO.dealer.label], ['officer', DEMO.officer.label]]) {
      await loginWithButton(page, label)
      await page.getByRole('navigation').waitFor()
      for (const route of PAGES[who]) {
        await step(`${who} page ${route} fits a 360 px phone and every control has a name`, () => check(who, route))
      }
      await logout(page)
    }
    await step('the page language and title are set', async () => {
      await page.goto(`${APP}/login`)
      const lang = await page.evaluate(() => document.documentElement.lang)
      const title = await page.title()
      if (!lang || !title) throw new Error(`lang="${lang}" title="${title}"`)
    })
    failures += report('Deep 3: small phone layout and accessibility', problems, steps)
    await close()
  }

  // ---------- slow hands, big photos, bad network
  {
    const { page, context, problems, allow, close } = await open()
    const { steps, step } = stepper()
    allow(400)
    await loginWithButton(page, DEMO.household.label)
    await page.getByText('Scan Waste').first().waitFor()

    await step('double-clicking Submit creates only one listing', async () => {
      await scanMock(page, 'Cardboard / Cartons')
      await page.getByRole('button', { name: /Create listing/ }).click()
      await page.getByLabel(/Weight/).fill('2')
      await page.getByRole('button', { name: 'Submit listing' }).dblclick()
      await page.getByText('Your neighbourhood pool').waitFor()
      await nav(page, /My Listings/).click()
      await page.getByRole('heading', { name: /My Listings/ }).waitFor()
      await page.locator('h2').first().waitFor()
      const n =await page.locator('h2', { hasText: 'Cardboard / Cartons' }).count()
      if (n !== 1) throw new Error(`${n} cardboard listings were created`)
    })

    await step('a large phone photo is shrunk before upload', async () => {
      const big = path.join(SHOTS, 'big.jpg')
      const dataUrl = await page.evaluate(async () => {
        const c = document.createElement('canvas')
        c.width = 4000
        c.height = 3000
        const g = c.getContext('2d')
        for (let i = 0; i < 4000; i += 40) {
          g.fillStyle = `hsl(${i % 360},70%,50%)`
          g.fillRect(i, 0, 40, 3000)
        }
        const noise = g.getImageData(0, 0, 4000, 3000)
        for (let i = 0; i < noise.data.length; i += 4) noise.data[i] = (noise.data[i] + (i * 7) % 90) % 255
        g.putImageData(noise, 0, 0)
        return c.toDataURL('image/jpeg', 0.95)
      })
      fs.writeFileSync(big, Buffer.from(dataUrl.split(',')[1], 'base64'))
      const originalSize = fs.statSync(big).size
      let sent = 0
      await page.route('**/api/v1/scan', async (route) => {
        sent = route.request().postDataBuffer()?.length ?? 0
        await route.continue()
      })
      await nav(page, /Scan/).click()
      await page.locator('input[type=file]').setInputFiles(big)
      await page.locator('main').getByRole('combobox').selectOption({ label: 'Glass Bottle' })
      await page.getByRole('button', { name: /Look up item/ }).click()
      await page.getByText('Market estimate').waitFor()
      if (!(sent > 0 && sent < originalSize / 2 && sent < 1_500_000)) {
        throw new Error(`original ${(originalSize / 1e6).toFixed(1)} MB, uploaded ${(sent / 1e6).toFixed(1)} MB`)
      }
    })

    await step('losing the network shows a friendly message, not a technical one', async () => {
      await nav(page, /My Listings/).click()
      await page.getByText('My Listings').first().waitFor()
      await context.setOffline(true)
      await nav(page, /Home/).click()
      const text = await page.getByRole('alert').innerText({ timeout: 5000 })
      await context.setOffline(false)
      if (/failed to fetch|networkerror|load failed/i.test(text) || !/connection|reach|offline|internet/i.test(text)) {
        throw new Error(`shown to the user: "${text}"`)
      }
    })

    await step('the app recovers when the network comes back', async () => {
      await page.reload()
      await page.getByText('Scan Waste').first().waitFor()
    })

    await step('a server error (500) is shown as a readable message', async () => {
      await page.route('**/api/v1/home', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"status":500,"error":"Internal Server Error"}' }))
      await page.reload()
      const text = await page.getByRole('alert').innerText({ timeout: 5000 })
      await page.unroute('**/api/v1/home')
      if (/internal server error|status|\{/i.test(text)) throw new Error(`shown to the user: "${text}"`)
    })
    failures += report('Deep 4: slow hands, big photos and bad networks', problems.filter((p) => !/500|Failed to load resource/.test(p)), steps)
    await close()
  }

  return failures
}
