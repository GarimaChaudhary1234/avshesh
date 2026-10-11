// Merges src/i18n/parts/*.json into en.json, hi.json and or.json, and checks them.
//
// Every part file is a flat object: "dotted.key": ["English", "हिन्दी", "ଓଡ଼ିଆ"]
// Checks: no key defined twice, three non-empty texts per key, same {{placeholders}} in all three languages,
// Hindi text has Devanagari letters, Odia text has Odia letters, and every literal t('key') used in src/ exists.
// A key built at run time (t(`role.${x}`)) cannot be seen by the last check, so list those keys in
// DYNAMIC_PREFIXES below only if the part files define the whole family.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const partsDir = join(root, 'i18n', 'parts')
const problems = []

const merged = {}
for (const file of readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort()) {
  const part = JSON.parse(readFileSync(join(partsDir, file), 'utf8'))
  for (const [key, value] of Object.entries(part)) {
    if (key in merged) problems.push(`${file}: key defined twice: ${key}`)
    else merged[key] = value
  }
}

const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',')
const out = { en: {}, hi: {}, or: {} }
for (const [key, value] of Object.entries(merged)) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((v) => typeof v !== 'string' || !v.trim())) {
    problems.push(`${key}: must be [english, hindi, odia], all non-empty`)
    continue
  }
  const [en, hi, or] = value
  if (placeholders(en) !== placeholders(hi) || placeholders(en) !== placeholders(or)) {
    problems.push(`${key}: placeholders differ between languages`)
  }
  if (!/[ऀ-ॿ]/.test(hi)) problems.push(`${key}: Hindi text has no Devanagari letters`)
  if (!/[଀-୿]/.test(or)) problems.push(`${key}: Odia text has no Odia letters`)
  out.en[key] = en
  out.hi[key] = hi
  out.or[key] = or
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') yield* sourceFiles(path)
    } else if (/\.(jsx?|mjs)$/.test(entry.name)) yield path
  }
}
const used = /\bt\(\s*(['"])([A-Za-z0-9_.-]+)\1/g
for (const file of sourceFiles(root)) {
  for (const m of readFileSync(file, 'utf8').matchAll(used)) {
    if (!(m[2] in merged)) problems.push(`${file.slice(root.length + 1)}: unknown key ${m[2]}`)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} i18n problem(s)`)
  process.exit(1)
}
for (const lang of ['en', 'hi', 'or']) {
  writeFileSync(join(root, 'i18n', `${lang}.json`), JSON.stringify(out[lang], null, 2) + '\n')
}
console.log(`i18n ok: ${Object.keys(merged).length} keys x 3 languages`)
