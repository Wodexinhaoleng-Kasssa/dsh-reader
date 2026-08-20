// 集成测试：临时 http server 挂 makeRoutes，模拟浏览器请求完整链路。
// 运行：node test-integration.mjs [keyword] [novelIndex]
import http from 'node:http'
import { makeRoutes } from './lib/routes.js'

const keyword = process.argv[2] ?? '雪中悍刀行'
const novelIndex = Number(process.argv[3] ?? 0)

const { routes } = makeRoutes()
const server = http.createServer(async (req, res) => {
  // 伪造 loopback 头（真实请求来自 127.0.0.1 时 socket.remoteAddress 就是 127.0.0.1）
  for (const route of routes) {
    if (route.kind !== 'exact') continue
    const url = new URL(req.url, 'http://127.0.0.1:3080')
    if (url.pathname !== route.path) continue
    try {
      await route.handler(req, res)
    } catch (error) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: String(error) }))
    }
    return
  }
  res.writeHead(404)
  res.end()
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const base = 'http://127.0.0.1:' + port

async function post(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status)
  return data
}

console.log('== 1. 书源列表 ==')
const sources = await (await fetch(base + '/api/dsh-reader/sources')).json()
console.log('书源数:', sources.sources.length)

console.log('== 2. 搜索《' + keyword + '》 ==')
const search = await post('/api/dsh-reader/search', { keyword })
console.log('结果:', search.results.length, '条; 失败源:', search.errors.length, '个')
for (const r of search.results.slice(0, 8)) console.log('  -', r.source, '|', r.title, '|', r.author, '|', r.url.slice(0, 60))
if (search.results.length === 0) {
  console.log('搜索无结果，测试终止')
  server.close()
  process.exit(1)
}

const book = search.results[Math.min(novelIndex, search.results.length - 1)]
console.log('== 3. 章节列表（' + book.source + ' / ' + book.title + '） ==')
const chapters = await post('/api/dsh-reader/chapters', { source: book.source, url: book.url })
console.log('章节数:', chapters.chapters.length)
if (chapters.chapters.length === 0) {
  console.log('无章节，测试终止')
  server.close()
  process.exit(1)
}
console.log('前3章:', chapters.chapters.slice(0, 3).map((c) => c.title).join(' / '))

console.log('== 4. 正文（第1章） ==')
const content = await post('/api/dsh-reader/content', { source: book.source, url: chapters.chapters[0].url })
console.log('长度:', content.text.length, '| 开头:', JSON.stringify(content.text.slice(0, 80)))

console.log('== 5. 整本下载（仅前2章验证任务机制，随后取消） ==')
const created = await post('/api/dsh-reader/download', { source: book.source, url: book.url, title: book.title })
console.log('taskId:', created.taskId)
await new Promise((resolve) => setTimeout(resolve, 1500))
const status = await (await fetch(base + '/api/dsh-reader/download?id=' + created.taskId)).json()
console.log('状态:', status.task.status, status.task.current + '/' + status.task.total)
if (status.task.status === 'running') {
  const cancelled = await post('/api/dsh-reader/download/cancel', { id: created.taskId })
  console.log('取消:', cancelled.cancelled)
}

console.log('== 完成 ==')
server.close()
process.exit(0)
