/**
 * /api/dsh-reader 路由族：书源列表、搜索、章节、正文、整本下载（进度轮询）。
 * 全部路由带 loopback-only 防护（同 dsh-ssh）：书源抓取会访问外部网站并
 * 写本地磁盘，LAN 暴露的 dsh web 部署不得提供服务。
 */
import { DownloadManager } from './downloads.js'
import { searchBook, getChapters, getContent, BookSourceError, MAX_SEARCH_SOURCES } from './engine.js'
import { decodeBuffer } from './engine.js'
import { scanLocalBooks, readLocalBook, splitTxtChapters, localBooksDir } from './localbooks.js'
import { BUILTIN_SOURCES } from './bsdata.js'

export const READER_API = {
  sources: '/api/dsh-reader/sources',
  search: '/api/dsh-reader/search',
  chapters: '/api/dsh-reader/chapters',
  content: '/api/dsh-reader/content',
  download: '/api/dsh-reader/download',
  cancel: '/api/dsh-reader/download/cancel',
  localScan: '/api/dsh-reader/local/scan',
  localRead: '/api/dsh-reader/local/read',
}

/** 单次搜索关键字超时（每个书源请求自带超时，这里再兜底）。 */
const SEARCH_TIMEOUT_MS = 20000

/** loopback 检查（抄 dsh-ssh）。 */
function isLoopbackRequest(request) {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

async function readJsonBody(req, maxBytes = 256 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk
    size += buffer.length
    if (size > maxBytes) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 找到书源（按标题）。 */
function findSource(title) {
  return BUILTIN_SOURCES.find((s) => s.title === title) ?? null
}

/** 并发搜索多个书源（限制并发数，避免触发限流）。 */
async function searchAll(keyword, onProgress) {
  const sources = BUILTIN_SOURCES.slice(0, MAX_SEARCH_SOURCES)
  const results = []
  const errors = []
  let cursor = 0
  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= sources.length) return
      const source = sources[index]
      try {
        const items = await searchBook(source, keyword)
        for (const item of items) {
          results.push({ source: source.title, title: item.title, url: item.url, author: item.author })
        }
      } catch (error) {
        errors.push({ source: source.title, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return { results, errors }
}

/** 构建路由表。 */
export function makeRoutes() {
  const downloads = new DownloadManager()

  const guard = (req, res, method) => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' })
      return false
    }
    if ((req.method ?? 'GET') !== method) {
      writeJson(res, 405, { error: 'method not allowed: ' + req.method })
      return false
    }
    return true
  }

  const routes = [
    // ------------------------------------------------------------ sources
    {
      kind: 'exact',
      path: READER_API.sources,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const sources = BUILTIN_SOURCES.map((s) => ({
          title: s.title,
          host: s.host,
          query_url: s.query_url,
          query_charset: s.query_charset ?? 0,
          json: String(s.book_name_xpath ?? '').startsWith('/data'),
        }))
        writeJson(res, 200, { sources })
      },
    },
    // ------------------------------------------------------------ search
    {
      kind: 'exact',
      path: READER_API.search,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
        if (keyword === '') {
          writeJson(res, 400, { error: 'keyword is required' })
          return
        }
        try {
          const { results, errors } = await searchAll(keyword)
          writeJson(res, 200, { results, errors })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------------ chapters
    {
      kind: 'exact',
      path: READER_API.chapters,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const source = findSource(typeof body?.source === 'string' ? body.source : '')
        const url = typeof body?.url === 'string' ? body.url : ''
        if (source === null || url === '') {
          writeJson(res, 400, { error: 'source and url are required' })
          return
        }
        try {
          const chapters = await getChapters(source, url)
          writeJson(res, 200, { chapters })
        } catch (error) {
          writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------------ content
    {
      kind: 'exact',
      path: READER_API.content,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const source = findSource(typeof body?.source === 'string' ? body.source : '')
        const url = typeof body?.url === 'string' ? body.url : ''
        if (source === null || url === '') {
          writeJson(res, 400, { error: 'source and url are required' })
          return
        }
        try {
          const text = await getContent(source, url)
          writeJson(res, 200, { text })
        } catch (error) {
          writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------------ download
    {
      kind: 'exact',
      path: READER_API.download,
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (!guard(req, res, method)) return
        if (method === 'GET') {
          const url = new URL(req.url ?? '/', 'http://localhost')
          const id = url.searchParams.get('id') ?? ''
          const task = downloads.get(id)
          if (task === undefined) {
            writeJson(res, 404, { error: 'task not found' })
            return
          }
          writeJson(res, 200, { task })
          return
        }
        // POST：创建下载任务
        const body = await readJsonBody(req)
        const source = findSource(typeof body?.source === 'string' ? body.source : '')
        const url = typeof body?.url === 'string' ? body.url : ''
        const title = typeof body?.title === 'string' ? body.title : '未命名'
        const dir = typeof body?.dir === 'string' ? body.dir : undefined
        if (source === null || url === '') {
          writeJson(res, 400, { error: 'source and url are required' })
          return
        }
        try {
          const id = downloads.start({ source, bookUrl: url, title, dir })
          writeJson(res, 202, { taskId: id })
        } catch (error) {
          writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------------ cancel
    {
      kind: 'exact',
      path: READER_API.cancel,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = typeof body?.id === 'string' ? body.id : ''
        if (id === '') {
          writeJson(res, 400, { error: 'id is required' })
          return
        }
        writeJson(res, 200, { cancelled: downloads.cancel(id) })
      },
    },
    // ------------------------------------------------------------ local scan
    {
      kind: 'exact',
      path: READER_API.localScan,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const dir = url.searchParams.get('dir') ?? undefined
        try {
          const { dir: scannedDir, books } = await scanLocalBooks(dir)
          writeJson(res, 200, { dir: scannedDir, books })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------------ local read
    {
      kind: 'exact',
      path: READER_API.localRead,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req, 4 * 1024 * 1024)
        const path = typeof body?.path === 'string' ? body.path : ''
        if (path === '') {
          writeJson(res, 400, { error: 'path is required' })
          return
        }
        try {
          const { text, size } = await readLocalBook(path, decodeBuffer)
          const chapters = splitTxtChapters(text)
          writeJson(res, 200, { size, chapterCount: chapters.length, chapters })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
  ]

  return { routes, downloads }
}
