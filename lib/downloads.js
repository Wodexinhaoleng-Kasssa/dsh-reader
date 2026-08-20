/**
 * 整本下载任务管理：逐章抓取 → 拼接 TXT → 写入本地磁盘。
 * 任务进度通过 GET /api/dsh-reader/download?id= 轮询。
 */
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getChapters, getContent, chapterToTxt } from './engine.js'

export class DownloadManager {
  constructor() {
    /** @type {Map<string, object>} */
    this.tasks = new Map()
  }

  /** 启动下载任务。dir 为空时默认 ~/Downloads/dsh-reader。 */
  start({ source, bookUrl, title, dir }) {
    const id = randomUUID()
    const task = {
      id,
      status: 'running',
      sourceTitle: source.title,
      title: title || '未命名',
      total: 0,
      current: 0,
      path: null,
      error: null,
      cancelled: false,
      startedAt: Date.now(),
    }
    this.tasks.set(id, task)
    this._run(task, source, bookUrl, dir).catch((error) => {
      if (task.cancelled) return
      task.status = 'error'
      task.error = error instanceof Error ? error.message : String(error)
    })
    return id
  }

  async _run(task, source, bookUrl, dir) {
    const chapters = await getChapters(source, bookUrl)
    if (task.cancelled) {
      task.status = 'cancelled'
      return
    }
    task.total = chapters.length
    let out = ''
    for (let i = 0; i < chapters.length; i++) {
      if (task.cancelled) break
      const chapter = chapters[i]
      try {
        const content = await getContent(source, chapter.url)
        out += chapterToTxt(chapter.title, content)
      } catch (error) {
        out += '\n' + chapter.title + '\n\n[本章获取失败: ' + (error instanceof Error ? error.message : String(error)) + ']\n'
      }
      task.current = i + 1
    }
    if (task.cancelled) {
      task.status = 'cancelled'
      return
    }
    if (chapters.length === 0) {
      task.status = 'error'
      task.error = '未解析到任何章节（书源规则可能已失效）'
      return
    }
    const dirPath = dir !== undefined && String(dir).trim() !== '' ? String(dir).trim() : join(homedir(), 'Downloads', 'dsh-reader')
    await mkdir(dirPath, { recursive: true })
    const safe = String(task.title).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 80)
    const filePath = join(dirPath, safe + '.txt')
    await writeFile(filePath, '\ufeff' + out, 'utf8')
    task.path = filePath
    task.status = 'done'
  }

  /** 状态快照（不含内部字段）。 */
  get(id) {
    const task = this.tasks.get(id)
    if (task === undefined) return undefined
    return {
      id: task.id,
      status: task.status,
      sourceTitle: task.sourceTitle,
      title: task.title,
      total: task.total,
      current: task.current,
      path: task.path,
      error: task.error,
      startedAt: task.startedAt,
    }
  }

  cancel(id) {
    const task = this.tasks.get(id)
    if (task === undefined || task.status !== 'running') return false
    task.cancelled = true
    return true
  }
}
