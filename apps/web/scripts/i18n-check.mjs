// Fails when en/ja key sets differ or a key is not referenced from src/.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const flatten = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${p}${k}.`) : [`${p}${k}`]))

const en = new Set(flatten(JSON.parse(readFileSync('src/i18n/en.json', 'utf8'))))
const ja = new Set(flatten(JSON.parse(readFileSync('src/i18n/ja.json', 'utf8'))))
const errors = []
for (const k of en) if (!ja.has(k)) errors.push(`missing in ja: ${k}`)
for (const k of ja) if (!en.has(k)) errors.push(`missing in en: ${k}`)

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) && !/\.test\./.test(p) ? [p] : []
  })
const src = walk('src').map((f) => readFileSync(f, 'utf8')).join('\n')
const literals = new Set([...src.matchAll(/['"`]([A-Za-z][\w-]*(?:\.[\w-]+)+)['"`]/g)].map((m) => m[1]))
const prefixes = [...src.matchAll(/`([A-Za-z][\w.-]*\.)\$\{/g)].map((m) => m[1])
for (const k of en) {
  const used = literals.has(k) || prefixes.some((p) => k.startsWith(p))
  if (!used) errors.push(`unused key: ${k}`)
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`i18n ok: ${en.size} keys`)
