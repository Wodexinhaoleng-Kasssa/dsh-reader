/**
 * 书源引擎：HTTP 抓取 + 编码识别 + HTML/JSON 解析 + 章节/正文提取 + 过滤。
 * 语义移植自 binbyu/Reader 的 OnlineBook.cpp / HtmlParser（libxml2 xpath）。
 */
import iconv from 'iconv-lite'
import { parseHtml, parseJson, xpathTexts, xpathText, xpathAttrs, jsonPath, getText } from './xpath.js'

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 请求超时（默认 20s）。 */
const REQUEST_TIMEOUT_MS = 20000
/** 章节/内容分页抓取上限，防死循环。 */
const MAX_PAGES = 60
/** 单次搜索并发书源数量上限。 */
export const MAX_SEARCH_SOURCES = 10

class BookSourceError extends Error {}

/** 关键字编码：charset 0=auto(utf8) 1=utf8 2=gbk。 */
function encodeKeyword(keyword, charset) {
  if (charset === 2) {
    const buf = iconv.encode(keyword, 'gbk')
    let out = ''
    for (const byte of buf) out += '%' + byte.toString(16).toUpperCase().padStart(2, '0')
    return out
  }
  return encodeURIComponent(keyword)
}

/** 相对 URL 拼接（移植原版 combine_url 语义）。 */
export function combineUrl(base, path) {
  if (path === undefined || path === null || path === '') return ''
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('//')) {
    const proto = /^https:/i.test(base) ? 'https:' : 'http:'
    return proto + path
  }
  try {
    return new URL(path, base).href
  } catch {
    return path
  }
}

/** 发起请求，返回 Buffer。 */
async function request(url, { method = 'GET', body, charset, referer, timeoutMs = REQUEST_TIMEOUT_MS, retries = 2 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers = {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
      if (referer !== undefined) headers.referer = referer
      if (method === 'POST') {
        headers['content-type'] = 'application/x-www-form-urlencoded; charset=' + (charset === 2 ? 'GBK' : 'UTF-8')
      }
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? body : undefined,
        redirect: 'follow',
        signal: controller.signal,
      })
      if (!response.ok) throw new BookSourceError('HTTP ' + response.status + ' ' + response.statusText)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  throw new BookSourceError('请求失败: ' + (lastError instanceof Error ? lastError.message : String(lastError)))
}

/** 响应解码：charset 0=auto 1=utf8 2=gbk。 */
export function decodeBuffer(buf, charset) {
  if (charset === 2) return iconv.decode(buf, 'gbk')
  if (charset === 1) {
    const text = buf.toString('utf8')
    return text.includes('\uFFFD') && !/^\uFEFF/.test(text) ? iconv.decode(buf, 'gbk') : text
  }
  // auto：BOM 优先
  if (buf.length >= 2) {
    if (buf[0] === 0xef && buf[1] === 0xbb) return buf.toString('utf8').replace(/^\uFEFF/, '')
    if (buf[0] === 0xff && buf[1] === 0xfe) return iconv.decode(buf, 'utf16-le').replace(/^\uFEFF/, '')
    if (buf[0] === 0xfe && buf[1] === 0xff) return iconv.decode(buf, 'utf16-be').replace(/^\uFEFF/, '')
  }
  // 先看 Content-Type 无法获得（fetch 已丢 header？可保留）→ utf-8 严格探测
  const utf8 = buf.toString('utf8')
  if (!utf8.includes('\uFFFD')) return utf8
  return iconv.decode(buf, 'gbk')
}

/** 构造搜索 URL / POST body（%s 替换）。 */
function buildQuery(source, keyword) {
  const encoded = encodeKeyword(keyword, source.query_charset ?? 0)
  const url = (source.query_url ?? '').replace(/%s/g, encoded)
  const params = (source.query_params ?? '').replace(/%s/g, encoded)
  const method = params !== '' ? 'POST' : (source.query_method === 1 ? 'POST' : 'GET')
  return { url, method, body: method === 'POST' ? params : undefined }
}

/** 搜索一本书：返回 [{title, url, author}]。 */
export async function searchBook(source, keyword) {
  const { url, method, body } = buildQuery(source, keyword)
  const buf = await request(url, {
    method,
    body,
    charset: source.query_charset ?? 0,
    referer: source.host,
    retries: 1,
  })
  const text = decodeBuffer(buf, source.query_charset ?? 0)
  const isJson = text.trimStart().startsWith('{') || text.trimStart().startsWith('[')
  if (isJson) {
    const root = parseJson(text)
    if (root === null) throw new BookSourceError('书源返回的 JSON 无法解析')
    const titles = jsonPath(root, source.book_name_xpath)
    const urls = jsonPath(root, source.book_mainpage_xpath)
    const authors = jsonPath(root, source.book_author_xpath)
    const count = Math.max(titles.length, urls.length)
    const results = []
    for (let i = 0; i < count; i++) {
      results.push({
        title: titles[i] ?? '',
        url: combineUrl(source.host, urls[i] ?? ''),
        author: authors[i] ?? '',
      })
    }
    return results.filter((r) => r.title !== '')
  }
  const root = parseHtml(text)
  const titles = xpathTexts(root, source.book_name_xpath)
  const urls = xpathAttrs(root, source.book_mainpage_xpath)
  const authors = xpathTexts(root, source.book_author_xpath)
  const count = Math.min(titles.length, urls.length)
  const results = []
  for (let i = 0; i < count; i++) {
    results.push({
      title: titles[i],
      url: combineUrl(url, urls[i]),
      author: authors[i] ?? '',
    })
  }
  return results.filter((r) => r.title !== '')
}

/** 抓取一个 URL 并返回文档树（或 JSON 对象）。 */
async function fetchDocument(source, url) {
  const buf = await request(url, { charset: source.query_charset ?? 0, referer: source.host, retries: 1 })
  const text = decodeBuffer(buf, source.query_charset ?? 0)
  if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
    return { kind: 'json', root: parseJson(text), text }
  }
  return { kind: 'html', root: parseHtml(text), text }
}

/** 获取章节列表（支持分页）。返回 [{title, url}]。 */
export async function getChapters(source, bookUrl) {
  const doc = await fetchDocument(source, bookUrl)
  if (doc.kind === 'json') {
    // JSON 书源的章节列表：书主页 URL 本身是 API（规则用 html xpath 的不适用，直接失败）
    throw new BookSourceError('JSON 书源的章节列表暂不支持')
  }
  let pageUrl = bookUrl
  if (source.enable_chapter_page === 1 && source.chapter_page_xpath) {
    const next = xpathAttrs(doc.root, source.chapter_page_xpath)
    if (next.length > 0) {
      pageUrl = combineUrl(bookUrl, next[0])
    }
  }
  const chapters = []
  const seen = new Set()
  for (let page = 0; page < MAX_PAGES; page++) {
    const pageDoc = await fetchDocument(source, pageUrl)
    if (pageDoc.kind !== 'html') break
    const titles = xpathTexts(pageDoc.root, source.chapter_title_xpath)
    const urls = xpathAttrs(pageDoc.root, source.chapter_url_xpath)
    const count = Math.min(titles.length, urls.length)
    for (let i = 0; i < count; i++) {
      const url = combineUrl(pageUrl, urls[i])
      if (seen.has(url)) continue
      seen.add(url)
      chapters.push({ title: titles[i], url })
    }
    if (source.enable_chapter_next !== 1) break
    const nextUrls = xpathAttrs(pageDoc.root, source.chapter_next_url_xpath ?? '')
    const nextKeywords = xpathTexts(pageDoc.root, source.chapter_next_keyword_xpath ?? '')
    if (nextUrls.length === 0 || nextKeywords.length === 0) break
    const keyword = String(source.chapter_next_keyword ?? '')
    if (keyword !== '' && !keyword.includes(nextKeywords[0])) break
    pageUrl = combineUrl(pageUrl, nextUrls[0])
  }
  return chapters
}

/** 单章正文提取（支持内容分页 + 广告过滤）。 */
export async function getContent(source, chapterUrl) {
  let text = ''
  let pageUrl = chapterUrl
  for (let page = 0; page < MAX_PAGES; page++) {
    const doc = await fetchDocument(source, pageUrl)
    if (doc.kind !== 'html') break
    const parts = xpathTexts(doc.root, source.content_xpath ?? '')
    if (parts.length > 0) text += parts.join('\n') + '\n'
    if (source.enable_content_next !== 1) break
    const nextUrls = xpathAttrs(doc.root, source.content_next_url_xpath ?? '')
    const nextKeywords = xpathTexts(doc.root, source.content_next_keyword_xpath ?? '')
    if (nextUrls.length === 0 || nextKeywords.length === 0) break
    const keyword = String(source.content_next_keyword ?? '')
    if (keyword !== '' && !keyword.includes(nextKeywords[0])) break
    pageUrl = combineUrl(pageUrl, nextUrls[0])
  }
  return filterContent(text, source)
}

/** 广告/无用文本过滤（移植原版 FilterContent）。 */
export function filterContent(text, source) {
  let out = text
  const type = source.content_filter_type ?? 0
  const keyword = String(source.content_filter_keyword ?? '')
  if (type === 1 && keyword !== '') {
    out = out.split(keyword).join('')
  } else if (type === 2 && keyword !== '') {
    try {
      const regex = new RegExp(keyword, 'g')
      out = out.replace(regex, '')
    } catch {
      // 无效正则：忽略过滤
    }
  }
  // 清理常见零宽/控制字符与多余空行
  out = out.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  out = out.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return out
}

/** 章节文本 → TXT 内容（章节标题 + 正文）。 */
export function chapterToTxt(title, text) {
  return '\n' + title + '\n\n' + text + '\n'
}

export { BookSourceError }
