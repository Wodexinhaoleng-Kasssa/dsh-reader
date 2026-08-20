// 合并书源：Reader_v2.0.0.4_x64/.bs_bak.json（31 个）为基底 + 旧 bs.json 缺失源补漏
// 运行：node scripts/merge-bsdata.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const bak = JSON.parse(readFileSync('D:/Reader_v2.0.0.4_x64/.bs_bak.json', 'utf8')).book_sources
// 旧源：官方 GitHub bs.json（原始 13 个）
const cur = JSON.parse(readFileSync('D:/AI_task/.reader_src/bs.json', 'utf8')).book_sources

// 1) bak 为基底（深拷贝）
const merged = bak.map((s) => ({ ...s }))

// 2) 修正 bak 晋江 content_xpath（正文容器，实测过）
const jj = merged.find((s) => s.title === '晋江文学城')
if (jj !== undefined) jj.content_xpath = '//*[@id="paragraph_comment_content"]'

// 3) 补旧源中 bak 缺失的
const bakTitles = new Set(merged.map((s) => s.title))
for (const s of cur) {
  if (!bakTitles.has(s.title)) merged.push({ ...s })
}

// 4) 输出
let out = '// 内置书源数据：合并自 binbyu/Reader 官方 bs.json（GitHub）与\n'
out += '// Reader_v2.0.0.4_x64/.bs_bak.json（v2.0.0.4 发布包内置，31 个）+ 旧源补漏。\n'
out += '// 晋江 content_xpath 已修正为 #paragraph_comment_content（实测正文容器）。\n'
out += '// 书源网站可能失效/改版，规则可在本文件增删。\n'
out += 'export const BUILTIN_SOURCES = ' + JSON.stringify(merged, null, 2) + ';\n'
writeFileSync(new URL('../lib/bsdata.js', import.meta.url), out)
console.log('merged:', merged.length, '个书源')
console.log('晋江 content_xpath:', merged.find((s) => s.title === '晋江文学城').content_xpath)
