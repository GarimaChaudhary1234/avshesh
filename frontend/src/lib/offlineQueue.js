import { api } from './api'

// Listing drafts made while offline wait here. This is plain localStorage (small, synchronous, enough for a
// handful of drafts), not IndexedDB. Photos are never queued: a scan needs the network, so only the finished
// listing (item, weight, pickup window) is saved.
const KEY = 'avshesh.queue'
const listeners = new Set()

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

const write = (items) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // storage full or blocked: the draft is lost, the caller already told the user
  }
  listeners.forEach((fn) => fn(items.length))
}

export const pendingCount = () => read().length

/** Saves a listing body for later. Returns how many drafts are waiting. */
export function queueListing(body) {
  const items = [...read(), { body, savedAt: Date.now() }]
  write(items)
  return items.length
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let syncing = null

/**
 * Sends the saved drafts one by one. A network failure stops the run and keeps the rest for next time.
 * A draft the server refuses (pool full, phone not verified, ...) is dropped and counted as failed,
 * because sending the same refused request again would never succeed.
 */
export function syncQueue() {
  if (syncing) return syncing
  syncing = (async () => {
    let sent = 0
    let failed = 0
    for (const item of read()) {
      try {
        await api.createListing(item.body)
        sent += 1
      } catch (err) {
        if (err.status === 0 || err.status >= 500 || err.status === 401) break
        failed += 1
      }
      write(read().filter((i) => i.savedAt !== item.savedAt))
    }
    return { sent, failed }
  })().finally(() => {
    syncing = null
  })
  return syncing
}
