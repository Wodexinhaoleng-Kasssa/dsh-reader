/**
 * 书源规则提取引擎：XPath 子集 + JSON 路径 + 文本格式化。
 *
 * 原版 Reader 用 libxml2 的 xpath（规则见 doc/bs.md），这里实现书源规则
 * 实际用到的语法子集：
 *   - 轴：/（子）、//（后代）、.//（后代）
 *   - 节点测试：标签名、*（任意）、text()（文本节点）
 *   - 属性步骤：/@href（取属性值，字符串）
 *   - 谓词：[@attr='v'] [@attr="v"] [position()>N] [N]（位置）
 *   - JSON 路径：/data/search/book_name（对象键路径，数组自动展开取每项）
 *
 * HTML 由 htmlparser2 解析成 domhandler 树：元素 {type:'tag',name,attribs,
 * children}，文本 {type:'text',data}，注释/指令忽略。
 */
import { parseDocument } from 'htmlparser2'

const BLOCK_TAGS = new Set(['p', 'div', 'li', 'dd', 'dt', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote', 'pre', 'table'])

/** 按顶层 | 拆分 XPath 联合表达式（忽略引号与方括号内的 |）。 */
export function splitXPath(expr) {
  const branches = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (quote !== '') {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }
    if (ch === '[') depth++
    else if (ch === ']') depth = Math.max(0, depth - 1)
    else if (ch === '|' && depth === 0) {
      branches.push(expr.slice(start, i).trim())
      start = i + 1
    }
  }
  branches.push(expr.slice(start).trim())
  return branches.filter((b) => b !== '')
}

/** 解析 xpath 表达式为步骤列表。 */
export function parseXPath(expr) {
  const steps = []
  let i = 0
  const n = expr.length
  while (i < n) {
    let axis = 'child'
    if (expr.startsWith('//', i)) {
      axis = 'descendant'
      i += 2
    } else if (expr.startsWith('.//', i)) {
      axis = 'descendant'
      i += 3
    } else if (expr[i] === '/') {
      i += 1
    } else {
      break
    }
    // node test：直到 / [ 或结尾（注意 @attr 与 text()）
    let j = i
    while (j < n && expr[j] !== '/' && expr[j] !== '[') j++
    const test = expr.slice(i, j)
    i = j
    // 谓词
    const preds = []
    while (i < n && expr[i] === '[') {
      let depth = 1
      let k = i + 1
      while (k < n && depth > 0) {
        if (expr[k] === '[') depth++
        else if (expr[k] === ']') depth--
        k++
      }
      preds.push(expr.slice(i + 1, k - 1))
      i = k
    }
    if (test !== '' || preds.length > 0 || axis === 'descendant') {
      steps.push({ axis, test, preds })
    }
  }
  return steps
}

/** 求值谓词：attr 相等 / position()>N / 位置数字。候选按文档顺序。 */
function matchPredicates(node, preds, index, total) {
  for (const raw of preds) {
    const pred = raw.trim()
    if (pred === '') continue
    // @attr='v' 或 @attr="v"
    const attrMatch = /^@([\w-]+)\s*=\s*(['"])(.*?)\2$/.exec(pred)
    if (attrMatch !== null) {
      const value = node.type === 'tag' ? node.attribs[attrMatch[1]] : undefined
      if (value !== attrMatch[3]) return false
      continue
    }
    // @attr（存在性）
    if (/^@[\w-]+$/.test(pred)) {
      if (node.type !== 'tag' || !(pred.slice(1) in node.attribs)) return false
      continue
    }
    // position()>N / >=N / =N / <N / <=N
    const posMatch = /^position\(\)\s*(>|>=|=|<|<=)\s*(\d+)$/.exec(pred)
    if (posMatch !== null) {
      const num = Number(posMatch[2])
      const pos = index + 1
      const op = posMatch[1]
      if (op === '>' && !(pos > num)) return false
      if (op === '>=' && !(pos >= num)) return false
      if (op === '=' && !(pos === num)) return false
      if (op === '<' && !(pos < num)) return false
      if (op === '<=' && !(pos <= num)) return false
      continue
    }
    // 纯数字 [N]
    if (/^\d+$/.test(pred)) {
      if (index + 1 !== Number(pred)) return false
      continue
    }
    // 其他谓词（contains、text()= 等）不支持：按不匹配处理，保持安全
    return false
  }
  return true
}

/** 节点测试匹配。 */
function testNode(node, test) {
  if (node.type === 'text') return test === 'text()' || test === 'text'
  if (node.type !== 'tag') return false
  if (test === '*' || test === '') return true
  return node.name === test
}

/**
 * 在节点列表上求值步骤序列。
 * @returns 元素/文本节点列表，或字符串列表（末步为 @attr 时）
 */
export function evalXPath(nodes, steps) {
  let current = nodes.filter((n) => n !== undefined && n !== null)
  for (const step of steps) {
    // 属性步骤（必须末步）
    if (step.test.startsWith('@')) {
      const attr = step.test.slice(1)
      const out = []
      for (const node of current) {
        if (node.type === 'tag' && node.attribs[attr] !== undefined) out.push(node.attribs[attr])
      }
      return out
    }
    const matched = []
    for (const node of current) {
      const candidates = []
      if (step.axis === 'child') {
        for (const child of node.children ?? []) {
          if (testNode(child, step.test)) candidates.push(child)
        }
      } else {
        // descendant：全树遍历（含自身？xpath // 不含自身，.// 含自身）
        const walk = (n) => {
          for (const child of n.children ?? []) {
            if (testNode(child, step.test)) candidates.push(child)
            if (child.type === 'tag') walk(child)
          }
        }
        walk(node)
      }
      candidates.forEach((cand, idx) => {
        if (matchPredicates(cand, step.preds, idx, candidates.length)) matched.push(cand)
      })
    }
    current = matched
    if (current.length === 0) return []
  }
  return current
}

/** 元素文本内容（块级元素间补换行，br 换行）。 */
export function getText(node) {
  if (node.type === 'text') return node.data
  if (node.type !== 'tag') return ''
  let out = ''
  for (const child of node.children ?? []) {
    if (child.type === 'text') {
      out += child.data
    } else if (child.type === 'tag') {
      if (child.name === 'br') {
        out += '\n'
      } else {
        out += getText(child)
        if (BLOCK_TAGS.has(child.name)) out += '\n'
      }
    }
  }
  return out
}

/** 便捷：xpath 取全部文本（每节点 textContent，多节点合并）。 */
export function xpathTexts(root, expr) {
  const out = []
  for (const branch of splitXPath(expr)) {
    const nodes = evalXPath([root], parseXPath(branch))
    for (const n of nodes) {
      if (typeof n === 'string') {
        out.push(n.replace(/\u00a0/g, ' ').trim())
      } else if (n.type === 'text' || n.type === 'tag') {
        out.push(getText(n).replace(/\u00a0/g, ' ').trim())
      }
    }
  }
  return out
}

/** 便捷：xpath 取单个文本（首个非空）。 */
export function xpathText(root, expr) {
  const list = xpathTexts(root, expr)
  return list.find((s) => s !== '') ?? ''
}

/** 便捷：xpath 取属性值列表（/@href 等）。 */
export function xpathAttrs(root, expr) {
  const out = []
  for (const branch of splitXPath(expr)) {
    const values = evalXPath([root], parseXPath(branch))
    for (const v of values) {
      if (typeof v === 'string') out.push(v)
    }
  }
  return out
}

/** JSON 路径求值（/data/search/book_name；数组自动展开）。返回字符串列表。 */
export function jsonPath(root, path) {
  const segs = String(path ?? '').split('/').filter(Boolean)
  if (segs.length === 0) return []
  let nodes = [root]
  for (const seg of segs) {
    const next = []
    for (const node of nodes) {
      const items = Array.isArray(node) ? node : [node]
      for (const item of items) {
        if (item !== null && typeof item === 'object' && seg in item) next.push(item[seg])
      }
    }
    nodes = next
  }
  return nodes.filter((v) => typeof v === 'string' || typeof v === 'number').map((v) => String(v).trim()).filter(Boolean)
}

/** 解析 HTML 字符串为文档树。 */
export function parseHtml(html) {
  return parseDocument(html, { decodeEntities: true, lowerCaseTags: true, recognizeSelfClosing: true })
}

/** 解析 JSON 字符串（失败返回 null）。 */
export function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
