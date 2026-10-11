// docker compose down -v && SCANNER=mock docker compose up -d && npm test   (inside tests/e2e)
import { deep } from './deep.mjs'
import { journeys } from './journeys.mjs'
import { ensureOtherOfficer } from './lib.mjs'
import { phase2 } from './phase2.mjs'

await ensureOtherOfficer()
let failures = await journeys()
failures += await deep()
failures += await phase2()
console.log(failures ? `\n${failures} problem(s) found` : '\nAll browser checks passed')
process.exit(failures ? 1 : 0)
