// 验证可用源的章节+正文链路：取第一本书 → 章节列表 → 第一章正文
// 运行：node scripts/test-chapters.mjs
import { searchBook, getChapters, getContent } from '../lib/engine.js'
import { BUILTIN_SOURCES } from '../lib/bsdata.js'

const keyword = process.argv[2] ?? '雪中悍刀行'
const titles = process.argv[3] ? process.argv[3].split(',') : null

const sources = BUILTIN_SOURCES.filter((s) => titles === null || titles.includes(s.title))
for (const source of sources) {
  try {
    const items = await searchBook(source, keyword)
    if (items.length === 0) { console.log(source.title, ':: 搜索 0 条，跳过'); continue }
    const chapters = await getChapters(source, items[0].url)
    if (chapters.length === 0) { console.log(source.title, ':: 章节 0 个 ❌'); continue }
    const content = await getContent(source, chapters[0].url)
    console.log(source.title, ':: 章节', chapters.length, '个 ✅ | 第一章', content.length, '字 |', chapters[0].title, '|', content.slice(0, 40).replace(/\s+/g, ' '))
  } catch (error) {
    console.log(source.title, ':: 失败 ❌', error.message.slice(0, 70))
  }
}
