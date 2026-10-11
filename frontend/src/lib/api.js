import i18n from '../i18n'

const BASE = import.meta.env.VITE_API_URL ?? ''
const USER_KEY = 'avshesh.user'

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * The login token lives in an HttpOnly cookie that JavaScript cannot read, so a script injected into the page
 * cannot steal it. All the browser keeps is the public profile of the user, to draw the screen quickly.
 */
export const session = {
  loadUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY))
    } catch {
      return null
    }
  },
  saveUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(USER_KEY)
  },
}

const readCookie = (name) => {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

async function request(path, { method = 'GET', body, form, retried = false } = {}) {
  const headers = { 'Accept-Language': i18n.language }
  if (method !== 'GET') {
    // Double-submit CSRF token: the server sets the XSRF-TOKEN cookie, we send it back in a header.
    const csrf = readCookie('XSRF-TOKEN')
    if (csrf) headers['X-XSRF-TOKEN'] = csrf
  }

  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE}/api/v1${path}`, { method, headers, body: payload, credentials: 'same-origin' })
  } catch {
    // fetch only throws when the request never got an answer: no network, or the server is down.
    throw new ApiError(0, i18n.t('errors.network'), 'NETWORK')
  }
  const data = await res.json().catch(() => null)

  if (res.status === 401 && session.loadUser() && !path.startsWith('/auth/')) {
    // The login cookie expired or was rejected: forget the user and go to the login page.
    session.clear()
    window.location.assign('/login')
  }
  if (res.status === 403 && data === null && method !== 'GET' && !retried) {
    // A bare 403 on a change request usually means the CSRF cookie was missing. A GET sets it again.
    await request('/me').catch(() => null)
    return request(path, { method, body, form, retried: true })
  }
  if (!res.ok) {
    if (res.status >= 500) {
      throw new ApiError(res.status, i18n.t('errors.server'), 'SERVER')
    }
    const fallback = res.status === 403 ? i18n.t('errors.forbidden') : i18n.t('errors.generic')
    throw new ApiError(res.status, data?.error ?? fallback, data?.code)
  }
  return data
}

export const api = {
  login: (phone, password) => request('/auth/login', { method: 'POST', body: { phone, password } }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  forgotPassword: (phone) => request('/auth/password/forgot', { method: 'POST', body: { phone } }),
  resetPassword: (body) => request('/auth/password/reset', { method: 'POST', body }),
  me: () => request('/me'),
  geoSearch: (q) => request(`/geo/search?q=${encodeURIComponent(q)}`),
  placeName: (lat, lng) => request(`/geo/reverse?lat=${lat}&lng=${lng}`),
  wardAt: (lat, lng) => request(`/geo/ward?lat=${lat}&lng=${lng}`),
  setLocation: (lat, lng) => request('/me/location', { method: 'PUT', body: { lat, lng } }),
  setLanguage: (language) => request('/me/language', { method: 'PUT', body: { language } }),
  sendPhoneCode: () => request('/me/phone/send-code', { method: 'POST' }),
  verifyPhone: (code) => request('/me/phone/verify', { method: 'POST', body: { code } }),
  notifications: () => request('/me/notifications'),
  markNotificationsRead: () => request('/me/notifications/read', { method: 'POST' }),
  catalog: () => request('/catalog'),
  scanMode: () => request('/scan/mode'),
  impact: (area) => request(`/impact${area ? `?area=${encodeURIComponent(area)}` : ''}`),

  // household
  home: () => request('/home'),
  scan: (file, hint) => {
    const form = new FormData()
    form.append('photo', file)
    if (hint) form.append('hint', hint)
    return request('/scan', { method: 'POST', form })
  },
  createListing: (body) => request('/listings', { method: 'POST', body }),
  myListings: () => request('/listings/mine'),
  answerPayment: (listingId, body) => request(`/listings/${listingId}/payment`, { method: 'POST', body }),
  myMunicipalRequests: () => request('/municipal-requests/mine'),
  requestMunicipalPickup: (body) => request('/municipal-requests', { method: 'POST', body }),
  nearbyPoints: () => request('/collection-points/nearby'),
  myRatings: () => request('/ratings/mine'),
  rateCollector: (body) => request('/ratings', { method: 'POST', body }),

  // collector
  collectorPools: () => request('/collector/pools'),
  profile: () => request('/collector/profile'),
  myRating: () => request('/collector/rating'),
  saveProfile: (body) => request('/collector/profile', { method: 'PUT', body }),
  rateCard: () => request('/collector/rate-card'),
  saveRateCard: (body) => request('/collector/rate-card', { method: 'PUT', body }),
  acceptPool: (poolId, start, end) =>
    request(`/pools/${poolId}/accept`, { method: 'POST', body: { start, end } }),
  pickups: () => request('/collector/pickups'),
  completeStop: (stopId, body) =>
    request(`/pickups/stops/${stopId}/complete`, { method: 'POST', body }),
  earnings: (days = 7) => request(`/collector/earnings?days=${days}`),

  // municipal corporation
  municipalOverview: () => request('/municipal/overview'),
  municipalQueue: () => request('/municipal/requests'),
  updateMunicipalRequest: (id, body) => request(`/municipal/requests/${id}`, { method: 'PUT', body }),
  municipalPoints: () => request('/municipal/collection-points'),
  createPoint: (body) => request('/municipal/collection-points', { method: 'POST', body }),
  updatePoint: (id, body) => request(`/municipal/collection-points/${id}`, { method: 'PUT', body }),
  municipalStaff: () => request('/municipal/staff'),
  createStaff: (body) => request('/municipal/staff', { method: 'POST', body }),
  setStaffActive: (id, active) => request('/municipal/staff/' + id, { method: 'PUT', body: { active } }),
  municipalCollectors: () => request('/municipal/collectors'),
  verifyCollector: (id, status) =>
    request(`/municipal/collectors/${id}/verification`, { method: 'POST', body: { status } }),
  municipalWards: () => request('/municipal/wards'),
  municipalWard: (id) => request(`/municipal/wards/${id}`),
  municipalActivity: (wardId) => request(`/municipal/activity${wardId ? `?wardId=${wardId}` : ''}`),
  municipalOfficers: () => request('/municipal/officers'),
  createOfficer: (body) => request('/municipal/officers', { method: 'POST', body }),
  updateOfficer: (id, body) => request(`/municipal/officers/${id}`, { method: 'PUT', body }),
  myWard: () => request('/me/ward'),
  staffTasks: () => request('/staff/tasks'),
  staffCollected: (id) => request(`/staff/tasks/${id}/collected`, { method: 'POST' }),
  staffProblem: (id, reason) => request(`/staff/tasks/${id}/problem`, { method: 'POST', body: { reason } }),
  municipalDisputes: () => request('/municipal/disputes'),
  resolveDispute: (stopId, note) =>
    request(`/municipal/disputes/${stopId}/resolve`, { method: 'POST', body: { note } }),
}
