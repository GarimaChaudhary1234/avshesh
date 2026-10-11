import fs from 'node:fs'
const fix = (file, bad, good) => {
  let s = fs.readFileSync(file, 'utf8')
  if (!s.includes(bad)) throw new Error(`${file}: ${bad}`)
  fs.writeFileSync(file, s.split(bad).join(good))
}
fix('tests/api/business.mjs', String.raw`/^d{10}$/.test(s.ownerPhone`, String.raw`/^\d{10}$/.test(s.ownerPhone`)
fix('tests/api/phase2.mjs', String.raw`/^\d{10}$/.test(s.ownerPhone`, String.raw`/^\d{10}$/.test(s.ownerPhone`)
// The cookie only counts as a login on pages that are not public. The place-name lookup lives under the public
// /geo prefix but needs a login, so it must not be treated as public (otherwise a logged-in browser was refused).
fix('backend/src/main/java/com/avshesh/security/SecurityConfig.java',
  '        String path = request.getRequestURI();\n        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);',
  '        String path = request.getRequestURI();\n        if (path.startsWith("/api/v1/geo/reverse")) {\n            return false;\n        }\n        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);')
