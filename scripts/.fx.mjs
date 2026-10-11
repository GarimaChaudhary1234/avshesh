import fs from 'node:fs'
const f = 'tests/api/phase2.mjs'
let s = fs.readFileSync(f, 'utf8')
const bad = String.raw`/^\d{10}$/.test(s.ownerPhone`
const good = String.raw`/^\d{10}$/.test(s.ownerPhone`
if (!s.includes(bad)) throw new Error('not found')
fs.writeFileSync(f, s.split(bad).join(good))
