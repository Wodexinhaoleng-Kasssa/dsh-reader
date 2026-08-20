// 批量测试书源可用性：并发搜索关键字，统计可用/失效
// 运行：node scripts/test-sources.mjs [关键字]
import { searchBook } from '../lib/engine.js'
import { BUILTIN_SOURCES } from '../lib/bsdata.js'

const keyword = process.argv[2] ?? '雪中悍刀行'
const CONCURRENCY = 4

const results = []
let cursor = 0
async function worker() {
  while (true) {
    const index = cursor++
    if (index >= BUILTIN_SOURCES.length) return
    const source = BUILTIN_SOURCES[index]
    const t0 = Date.now()
    try {
      const items = await searchBook(source, keyword)
      const dt = ((Date.now() - t0) / 1000).toFixed(1)
      results.push({ title: source.title, ok: items.length > 0, count: items.length, seconds: dt, first: items[0]?.title ?? '' })
    } catch (error) {
      results.push({ title: source.title, ok: false, count: 0, seconds: ((Date.now() - t0) / 1000).toFixed(1), error: error.message.slice(0, 60) })
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
results.sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0) || a.title.localeCompare(b.title, 'zh'))
const ok = results.filter((r) => r.ok)
console.log('== 可用书源:', ok.length, '/', results.length, '==')
for (const r of ok) console.log('  ✅', r.title.padEnd(12), r.count + '条', r.seconds + 's', '|', r.first.slice(0, 24))
console.log('== 失效书源 ==')
for (const r of results.filter((x) => !x.ok)) console.log('  ❌', r.title.padEnd(12), r.error ?? '0条')
