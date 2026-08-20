/**
 * dsh-reader — browser half.
 *
 * 在线小说阅读器：侧边栏「阅读器」入口 + 聊天伪装阅读界面。
 * 界面刻意做成与正常对话一致：顶栏（书名·章节）、消息流（章节 = 一条条
 * 对话消息）、底部输入框（指令 / 搜索）。小说正文以「assistant 消息」呈现，
 * 搜索结果/目录/书架以可点击的消息卡片呈现。
 *
 * 数据面：host 端 /api/dsh-reader（搜索/章节/正文/整本下载），IndexedDB
 * 书架（书籍 + 章节缓存 + 进度），localStorage 设置。
 */
window.__ModuleLoader__.load({
  id: '@linxin666/dsh-reader',
  factory: (require) => {
    'use strict'
    var module = { exports: {} }
    var exports = module.exports

    var inject = []

    // ================================================================ CSS
    var CSS = [
      /* 侧边栏入口 */
      '.rdr-entry{width:100%;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 12px;font-size:13px;display:flex}',
      '.rdr-entry:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}',
      '.rdr-entry[data-active]{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary);font-weight:600}',
      '.rdr-entryIcon{flex:none;justify-content:center;align-items:center;display:inline-flex}',
      '.rdr-entryLabel{text-overflow:ellipsis;overflow:hidden}',
      '[data-dsh-frame][data-sidebar-collapsed] .rdr-entry{justify-content:center;width:100%;padding:0}',
      '[data-dsh-frame][data-sidebar-collapsed] .rdr-entryLabel{display:none}',
      /* 面板容器（接管中央列，视觉 = 聊天界面） */
      '[data-dsh-reader-view]{z-index:60;background:var(--dsw-alias-bg-base);display:none;position:absolute;inset:0;color:var(--dsw-alias-label-primary)}',
      'html[data-dsh-reader-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-reader-view]{display:block}',
      'html[data-dsh-reader-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane=conversation]>:not([data-dsh-reader-view]),html[data-dsh-reader-active]:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*=centerCol]>:not([data-dsh-reader-view]){display:none!important}',
      /* 聊天布局 */
      '.rdr-chat{display:flex;flex-direction:column;height:100%;font-size:var(--rdr-font-size,14px)}',
      '.rdr-header{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);flex:none}',
      '.rdr-headerBack,.rdr-headerClose{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:16px;line-height:1;padding:6px 8px;border-radius:8px;flex:none}',
      '.rdr-headerBack:hover,.rdr-headerClose:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.rdr-headerMain{flex:1;min-width:0}',
      '.rdr-headerTitle{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rdr-headerSub{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rdr-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth}',
      '.rdr-msg{display:flex;gap:10px;max-width:100%}',
      '.rdr-msg-user{justify-content:flex-end}',
      '.rdr-bubble{max-width:78%;padding:9px 13px;border-radius:14px;font-size:var(--rdr-font-size,14px);line-height:var(--rdr-line-height,1.75);white-space:pre-wrap;word-break:break-word}',
      '.rdr-msg-user .rdr-bubble{background:var(--dsw-alias-accent-soft,rgba(0,102,255,.12));color:var(--dsw-alias-label-primary);border-bottom-right-radius:4px}',
      '.rdr-msg-assistant .rdr-bubble{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-bottom-left-radius:4px}',
      '.rdr-msg-system .rdr-bubble{background:transparent;border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12.5px}',
      '.rdr-chapterHead{font-size:16px;font-weight:700;color:var(--dsw-alias-label-primary);margin-bottom:6px}',
      '.rdr-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;max-width:78%}',
      '.rdr-cardRow{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.rdr-cardRow:last-child{border-bottom:none}',
      '.rdr-cardRow:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.rdr-cardMain{flex:1;min-width:0}',
      '.rdr-cardTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rdr-cardSub{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rdr-cardBadge{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);padding:2px 8px;border-radius:999px;flex:none}',
      '.rdr-cardList{max-height:320px;overflow-y:auto}',
      '.rdr-inputbar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);flex:none}',
      '.rdr-input{flex:1;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;color:var(--dsw-alias-label-primary);font-size:14px;padding:9px 13px;outline:none;min-width:0}',
      '.rdr-input:focus{border-color:var(--dsw-alias-accent-primary,var(--dsw-alias-label-secondary))}',
      '.rdr-input::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.rdr-send{border:none;border-radius:10px;background:var(--dsw-alias-accent-primary,#0a63e6);color:#fff;font-size:14px;padding:9px 18px;cursor:pointer;flex:none}',
      '.rdr-send:hover{filter:brightness(1.08)}',
      '.rdr-send:disabled{opacity:.5;cursor:default}',
      '.rdr-loading{display:inline-flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.rdr-loadingDot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-secondary);animation:rdr-blink 1s infinite}',
      '.rdr-loadingDot:nth-child(2){animation-delay:.2s}.rdr-loadingDot:nth-child(3){animation-delay:.4s}',
      '@keyframes rdr-blink{0%,80%,100%{opacity:.25}40%{opacity:1}}',
      '.rdr-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));padding:0 4px 2px;text-align:center}',
    ].join('')

    // ================================================================ API
    var API_BASE = '/api/dsh-reader'
    var API = {
      sources: API_BASE + '/sources',
      search: API_BASE + '/search',
      chapters: API_BASE + '/chapters',
      content: API_BASE + '/content',
      download: API_BASE + '/download',
      cancel: API_BASE + '/download/cancel',
    }

    async function apiPost(path, body) {
      var response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      var data
      try {
        data = await response.json()
      } catch (error) {
        data = null
      }
      if (!response.ok) {
        throw new Error((data && data.error) || ('HTTP ' + response.status))
      }
      return data
    }

    async function apiGet(path) {
      var response = await fetch(path)
      var data
      try {
        data = await response.json()
      } catch (error) {
        data = null
      }
      if (!response.ok) {
        throw new Error((data && data.error) || ('HTTP ' + response.status))
      }
      return data
    }

    // ============================================================ IndexedDB
    var DB_NAME = 'dsh-reader'
    var DB_VERSION = 1
    var dbPromise = null

    function openDb() {
      if (dbPromise !== null) return dbPromise
      dbPromise = new Promise(function (resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = function (event) {
          var db = event.target.result
          if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' })
          if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'bookId' })
          if (!db.objectStoreNames.contains('bookmarks')) db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true })
        }
        request.onsuccess = function () { resolve(request.result) }
        request.onerror = function () { reject(request.error) }
      })
      return dbPromise
    }

    function dbRequest(request) {
      return new Promise(function (resolve, reject) {
        request.onsuccess = function () { resolve(request.result) }
        request.onerror = function () { reject(request.error) }
      })
    }

    async function dbPut(store, value) {
      var db = await openDb()
      return dbRequest(db.transaction(store, 'readwrite').objectStore(store).put(value))
    }

    async function dbGet(store, key) {
      var db = await openDb()
      return dbRequest(db.transaction(store, 'readonly').objectStore(store).get(key))
    }

    async function dbAll(store) {
      var db = await openDb()
      return dbRequest(db.transaction(store, 'readonly').objectStore(store).getAll())
    }

    async function dbDelete(store, key) {
      var db = await openDb()
      return dbRequest(db.transaction(store, 'readwrite').objectStore(store).delete(key))
    }

    // ================================================================= 状态
    var state = {
      open: false,
      current: null, // {id,title,author,source,url,chapters,chapterIndex}
      pollTimer: null,
    }

    var SETTINGS_KEY = 'dsh-reader-settings'
    function loadSettings() {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}
      } catch (error) {
        return {}
      }
    }
    function saveSettings(patch) {
      var settings = Object.assign(loadSettings(), patch)
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      applySettings(settings)
      return settings
    }
    function applySettings(settings) {
      var root = document.querySelector('[data-dsh-reader-view]')
      if (root === null) return
      if (settings.fontSize) root.style.setProperty('--rdr-font-size', settings.fontSize + 'px')
      if (settings.lineHeight) root.style.setProperty('--rdr-line-height', String(settings.lineHeight))
    }

    // ============================================================== 消息
    var messagesEl = null
    var inputEl = null
    var sendBtn = null
    var headerTitleEl = null
    var headerSubEl = null

    function scrollToBottom() {
      if (messagesEl !== null) messagesEl.scrollTop = messagesEl.scrollHeight
    }

    function addUserMessage(text) {
      var row = document.createElement('div')
      row.className = 'rdr-msg rdr-msg-user'
      var bubble = document.createElement('div')
      bubble.className = 'rdr-bubble'
      bubble.textContent = text
      row.appendChild(bubble)
      messagesEl.appendChild(row)
      scrollToBottom()
    }

    function addAssistantMessage(text, isSystem) {
      var row = document.createElement('div')
      row.className = 'rdr-msg ' + (isSystem ? 'rdr-msg-system' : 'rdr-msg-assistant')
      var bubble = document.createElement('div')
      bubble.className = 'rdr-bubble'
      bubble.textContent = text
      row.appendChild(bubble)
      messagesEl.appendChild(row)
      scrollToBottom()
      return bubble
    }

    function addChapterMessage(bookTitle, chapterTitle, text) {
      var row = document.createElement('div')
      row.className = 'rdr-msg rdr-msg-assistant'
      var bubble = document.createElement('div')
      bubble.className = 'rdr-bubble'
      var head = document.createElement('div')
      head.className = 'rdr-chapterHead'
      head.textContent = chapterTitle
      var body = document.createElement('div')
      body.textContent = text
      bubble.appendChild(head)
      bubble.appendChild(body)
      row.appendChild(bubble)
      messagesEl.appendChild(row)
      scrollToBottom()
      return row
    }

    function addCardMessage(title, rows) {
      var row = document.createElement('div')
      row.className = 'rdr-msg rdr-msg-assistant'
      var card = document.createElement('div')
      card.className = 'rdr-card'
      if (title) {
        var head = document.createElement('div')
        head.className = 'rdr-chapterHead'
        head.style.padding = '10px 14px 4px'
        head.style.fontSize = '14px'
        head.style.marginBottom = '0'
        head.textContent = title
        card.appendChild(head)
      }
      var list = document.createElement('div')
      list.className = 'rdr-cardList'
      for (var i = 0; i < rows.length; i++) {
        list.appendChild(rows[i])
      }
      card.appendChild(list)
      row.appendChild(card)
      messagesEl.appendChild(row)
      scrollToBottom()
      return row
    }

    function makeCardRow(mainHtml, badge, onClick) {
      var rowEl = document.createElement('div')
      rowEl.className = 'rdr-cardRow'
      var main = document.createElement('div')
      main.className = 'rdr-cardMain'
      main.innerHTML = mainHtml
      rowEl.appendChild(main)
      if (badge) {
        var badgeEl = document.createElement('span')
        badgeEl.className = 'rdr-cardBadge'
        badgeEl.textContent = badge
        rowEl.appendChild(badgeEl)
      }
      rowEl.addEventListener('click', onClick)
      return rowEl
    }

    function addLoadingMessage() {
      var row = document.createElement('div')
      row.className = 'rdr-msg rdr-msg-assistant'
      var bubble = document.createElement('div')
      bubble.className = 'rdr-bubble'
      var loading = document.createElement('span')
      loading.className = 'rdr-loading'
      loading.innerHTML = '<span class="rdr-loadingDot"></span><span class="rdr-loadingDot"></span><span class="rdr-loadingDot"></span>'
      bubble.appendChild(loading)
      row.appendChild(bubble)
      messagesEl.appendChild(row)
      scrollToBottom()
      return row
    }

    // ================================================================ 动作
    async function searchBooks(keyword) {
      var loading = addLoadingMessage()
      try {
        var data = await apiPost(API.search, { keyword: keyword })
        loading.remove()
        var rows = data.results.map(function (item) {
          return makeCardRow(
            '<div class="rdr-cardTitle">' + escapeHtml(item.title) + '</div><div class="rdr-cardSub">' + escapeHtml(item.author || '佚名') + '</div>',
            item.source,
            function () { openBook(item) },
          )
        })
        if (rows.length === 0) {
          var failed = data.errors.length > 0 ? '（全部书源失败：' + data.errors[0].error + '）' : ''
          addAssistantMessage('没有找到《' + keyword + '》' + failed, true)
          return
        }
        addCardMessage('找到 ' + data.results.length + ' 本《' + keyword + '》，点击打开：', rows)
      } catch (error) {
        loading.remove()
        addAssistantMessage('搜索失败：' + error.message, true)
      }
    }

    async function openBook(item) {
      var current = state.current
      if (current !== null) setHeader('正在打开…', '')
      addAssistantMessage('正在获取《' + item.title + '》的章节列表…', true)
      var bookId = item.source + '|' + item.url
      try {
        var data = await apiPost(API.chapters, { source: item.source, url: item.url })
        var chapters = (data.chapters || []).map(function (ch, index) {
          return { index: index, title: ch.title, url: ch.url, text: null }
        })
        if (chapters.length === 0) {
          addAssistantMessage('该书的章节列表为空（书源规则可能已失效）。', true)
          return
        }
        var book = {
          id: bookId,
          title: item.title,
          author: item.author || '',
          source: item.source,
          url: item.url,
          chapters: chapters,
          chapterIndex: 0,
          savedAt: Date.now(),
        }
        await dbPut('books', book)
        state.current = book
        setHeader(book.title, book.author ? book.author + ' · ' + book.source : book.source)
        addAssistantMessage('《' + book.title + '》已加入书架，开始阅读（输入「下一章」继续）。', true)
        await readChapter(0)
      } catch (error) {
        addAssistantMessage('打开书籍失败：' + error.message, true)
      }
    }

    async function readChapter(index) {
      var book = state.current
      if (book === null) return
      if (index < 0 || index >= book.chapters.length) {
        addAssistantMessage(index < 0 ? '已经是第一章了。' : '已经是最后一章了。', true)
        return
      }
      book.chapterIndex = index
      var chapter = book.chapters[index]
      if (chapter.text === null) {
        var loading = addLoadingMessage()
        try {
          var data = await apiPost(API.content, { source: book.source, url: chapter.url })
          chapter.text = data.text || '（本章内容为空）'
        } catch (error) {
          loading.remove()
          addAssistantMessage('本章获取失败：' + error.message, true)
          return
        } finally {
          loading.remove()
        }
        // 缓存到书架
        try {
          await dbPut('books', book)
        } catch (error) { /* 忽略缓存失败 */ }
      }
      setHeader(book.title, '第 ' + (index + 1) + ' 章 · ' + chapter.title + ' · ' + book.source)
      addChapterMessage(book.title, chapter.title, chapter.text)
      try {
        await dbPut('progress', { bookId: book.id, chapterIndex: index, updatedAt: Date.now() })
      } catch (error) { /* 忽略进度保存失败 */ }
    }

    async function nextChapter() {
      var book = state.current
      if (book === null) {
        addAssistantMessage('还没有打开书。输入书名搜索，或输入「书架」选择已保存的书。', true)
        return
      }
      await readChapter(book.chapterIndex + 1)
    }

    async function prevChapter() {
      var book = state.current
      if (book === null) return
      await readChapter(book.chapterIndex - 1)
    }

    async function jumpChapter(index) {
      var book = state.current
      if (book === null) return
      if (index < 0 || index >= book.chapters.length) {
        addAssistantMessage('章节序号超出范围（共 ' + book.chapters.length + ' 章）。', true)
        return
      }
      await readChapter(index)
    }

    async function showToc() {
      var book = state.current
      if (book === null) {
        addAssistantMessage('还没有打开书。', true)
        return
      }
      var rows = book.chapters.slice(0, 500).map(function (ch) {
        var current = ch.index === book.chapterIndex
        return makeCardRow(
          '<div class="rdr-cardTitle">' + escapeHtml(ch.title) + (current ? ' <span class="rdr-cardBadge">当前</span>' : '') + '</div>',
          String(ch.index + 1),
          function () { jumpChapter(ch.index) },
        )
      })
      addCardMessage('目录（共 ' + book.chapters.length + ' 章）：', rows)
    }

    async function showShelf() {
      var books = await dbAll('books')
      if (books.length === 0) {
        addAssistantMessage('书架还是空的。输入书名即可从在线书源搜索。', true)
        return
      }
      var rows = books.map(function (book) {
        var progress = book.chapters[book.chapterIndex] || { title: '' }
        return makeCardRow(
          '<div class="rdr-cardTitle">' + escapeHtml(book.title) + '</div><div class="rdr-cardSub">' + escapeHtml(book.source) + ' · ' + progress.title + '</div>',
          book.chapters.length + ' 章',
          function () { resumeBook(book.id) },
        )
      })
      addCardMessage('书架（点击继续阅读）：', rows)
    }

    async function resumeBook(bookId) {
      var book = await dbGet('books', bookId)
      if (book === undefined) {
        addAssistantMessage('书架中没有这本书。', true)
        return
      }
      state.current = book
      var progress = await dbGet('progress', bookId)
      var index = progress && typeof progress.chapterIndex === 'number' ? progress.chapterIndex : 0
      setHeader(book.title, book.author ? book.author + ' · ' + book.source : book.source)
      addAssistantMessage('继续阅读《' + book.title + '》。', true)
      await readChapter(index)
    }

    async function deleteBook(bookId) {
      await dbDelete('books', bookId)
      if (state.current !== null && state.current.id === bookId) {
        state.current = null
        setHeader('阅读器', '输入书名搜索在线书源')
      }
      showShelf()
    }

    async function startDownload() {
      var book = state.current
      if (book === null) {
        addAssistantMessage('还没有打开书。', true)
        return
      }
      addAssistantMessage('开始下载《' + book.title + '》…', true)
      var progressMsg = addAssistantMessage('准备中…', true)
      try {
        var created = await apiPost(API.download, { source: book.source, url: book.url, title: book.title })
        var taskId = created.taskId
        var poll = async function () {
          var data = await apiGet(API.download + '?id=' + encodeURIComponent(taskId))
          var task = data.task
          if (task.status === 'done') {
            progressMsg.textContent = '✅ 下载完成：' + task.path + '（共 ' + task.total + ' 章）'
            return
          }
          if (task.status === 'error') {
            progressMsg.textContent = '❌ 下载失败：' + (task.error || '未知错误')
            return
          }
          if (task.status === 'cancelled') {
            progressMsg.textContent = '已取消下载。'
            return
          }
          progressMsg.textContent = '下载中 ' + task.current + '/' + task.total + ' 章…'
          state.pollTimer = setTimeout(poll, 2000)
        }
        await poll()
      } catch (error) {
        progressMsg.textContent = '下载启动失败：' + error.message
      }
    }

    async function showSources() {
      try {
        var data = await apiGet(API.sources)
        var rows = data.sources.map(function (source) {
          return makeCardRow(
            '<div class="rdr-cardTitle">' + escapeHtml(source.title) + '</div><div class="rdr-cardSub">' + escapeHtml(source.host) + '</div>',
            source.json ? 'JSON' : 'HTML',
            function () { addAssistantMessage(source.title + '：' + source.host + '（书源规则内置，可在插件源码 lib/bsdata.js 中增删）。', true) },
          )
        })
        addCardMessage('内置书源（' + data.sources.length + ' 个）：', rows)
      } catch (error) {
        addAssistantMessage('获取书源失败：' + error.message, true)
      }
    }

    function showHelp() {
      addAssistantMessage(
        '指令说明：\n' +
        '· 输入任意书名 → 在线书源搜索\n' +
        '· 下一章 / 上一章 → 翻章\n' +
        '· 第N章 → 跳转章节\n' +
        '· 目录 → 章节列表\n' +
        '· 书架 → 已保存的书\n' +
        '· 下载 → 整本下载到本地（TXT）\n' +
        '· 书源 → 内置书源列表\n' +
        '· 设置 字号 18 / 设置 行距 2\n' +
        '· 打开 书名 → 书架内打开\n' +
        '· 删除 书名 → 从书架删除',
        true,
      )
    }

    function applySettingCommand(text) {
      var m = /^设置\s+(\S+)\s*(.*)$/.exec(text)
      if (m === null) return false
      var key = m[1]
      var value = m[2].trim()
      var settings = loadSettings()
      if (key === '字号') {
        var size = /^(大|小|中|\d+)$/.test(value) ? value : '16'
        var px = size === '大' ? 19 : size === '小' ? 13 : size === '中' ? 16 : Number(size)
        saveSettings({ fontSize: px })
        addAssistantMessage('字号已设为 ' + px + 'px。', true)
        return true
      }
      if (key === '行距') {
        var line = Number(value) || 1.75
        saveSettings({ lineHeight: line })
        addAssistantMessage('行距已设为 ' + line + '。', true)
        return true
      }
      addAssistantMessage('支持：设置 字号 大/小/数字、设置 行距 数字。', true)
      return true
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    // ================================================================ 输入
    function handleInput() {
      var text = inputEl.value.trim()
      if (text === '') return
      inputEl.value = ''
      addUserMessage(text)
      var lower = text.toLowerCase()
      if (/^(下一章|下章|下|下一页|next)$/.test(lower)) { nextChapter(); return }
      if (/^(上一章|上章|上|上一页|prev|previous)$/.test(lower)) { prevChapter(); return }
      var jump = /^第\s*(\d+)\s*章$/.exec(text)
      if (jump !== null) { jumpChapter(Number(jump[1]) - 1); return }
      if (/^(目录|章节|toc)$/.test(lower)) { showToc(); return }
      if (/^(书架|我的书|书库)$/.test(lower)) { showShelf(); return }
      if (/^(下载|保存|存书)$/.test(lower)) { startDownload(); return }
      if (/^(书源|书源管理)$/.test(lower)) { showSources(); return }
      if (/^(帮助|help|指令|命令)$/.test(lower)) { showHelp(); return }
      var open = /^打开\s+(.+)$/.exec(text)
      if (open !== null) { openFromShelf(open[1].trim()); return }
      var remove = /^删除\s+(.+)$/.exec(text)
      if (remove !== null) { removeFromShelf(remove[1].trim()); return }
      if (applySettingCommand(text)) return
      searchBooks(text)
    }

    async function openFromShelf(keyword) {
      var books = await dbAll('books')
      var hit = books.find(function (book) { return book.title.indexOf(keyword) !== -1 })
      if (hit === undefined) {
        addAssistantMessage('书架中没有《' + keyword + '》。', true)
        return
      }
      await resumeBook(hit.id)
    }

    async function removeFromShelf(keyword) {
      var books = await dbAll('books')
      var hit = books.find(function (book) { return book.title.indexOf(keyword) !== -1 })
      if (hit === undefined) {
        addAssistantMessage('书架中没有《' + keyword + '》。', true)
        return
      }
      await deleteBook(hit.id)
    }

    // ================================================================ 视图
    function setHeader(title, sub) {
      headerTitleEl.textContent = title
      headerSubEl.textContent = sub
    }

    function buildChat() {
      var view = document.createElement('div')
      view.className = 'rdr-chat'

      var header = document.createElement('div')
      header.className = 'rdr-header'
      var back = document.createElement('button')
      back.className = 'rdr-headerBack'
      back.textContent = '←'
      back.title = '回到会话'
      back.addEventListener('click', closePanel)
      var main = document.createElement('div')
      main.className = 'rdr-headerMain'
      headerTitleEl = document.createElement('div')
      headerTitleEl.className = 'rdr-headerTitle'
      headerTitleEl.textContent = '阅读器'
      headerSubEl = document.createElement('div')
      headerSubEl.className = 'rdr-headerSub'
      headerSubEl.textContent = '输入书名搜索在线书源'
      main.appendChild(headerTitleEl)
      main.appendChild(headerSubEl)
      var close = document.createElement('button')
      close.className = 'rdr-headerClose'
      close.textContent = '×'
      close.title = '关闭阅读器'
      close.addEventListener('click', closePanel)
      header.appendChild(back)
      header.appendChild(main)
      header.appendChild(close)

      messagesEl = document.createElement('div')
      messagesEl.className = 'rdr-messages'

      var hint = document.createElement('div')
      hint.className = 'rdr-hint'
      hint.textContent = '输入书名搜书 · 下一章 · 目录 · 书架 · 下载 · 帮助'

      var inputbar = document.createElement('div')
      inputbar.className = 'rdr-inputbar'
      inputEl = document.createElement('input')
      inputEl.className = 'rdr-input'
      inputEl.placeholder = '例如：雪中悍刀行 / 下一章 / 目录 / 下载 / 帮助'
      inputEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') handleInput()
      })
      // 首次打开：欢迎消息（与平时对话一致的引导）
      addAssistantMessage('我是阅读器，假装自己是个聊天机器人。\n输入书名即可从在线书源搜索小说；打开后输入「下一章」继续阅读。\n试试：雪中悍刀行 / 帮助', true)
      sendBtn = document.createElement('button')
      sendBtn.className = 'rdr-send'
      sendBtn.textContent = '发送'
      sendBtn.addEventListener('click', handleInput)
      inputbar.appendChild(inputEl)
      inputbar.appendChild(sendBtn)

      view.appendChild(header)
      view.appendChild(messagesEl)
      view.appendChild(hint)
      view.appendChild(inputbar)
      return view
    }

    function openPanel() {
      if (state.open) return
      state.open = true
      document.documentElement.removeAttribute('data-dsh-taskboard-active')
      document.documentElement.removeAttribute('data-dsh-ssh-active')
      document.documentElement.setAttribute('data-dsh-reader-active', '')
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'reader' }))
      var entry = document.querySelector('[data-dsh-reader-entry]')
      if (entry !== null) entry.setAttribute('data-active', '')
      if (state.current === null) setHeader('阅读器', '输入书名搜索在线书源')
      inputEl.focus()
    }

    function closePanel() {
      if (!state.open) return
      state.open = false
      document.documentElement.removeAttribute('data-dsh-reader-active')
      var entry = document.querySelector('[data-dsh-reader-entry]')
      if (entry !== null) entry.removeAttribute('data-active')
    }

    // ======================================================== 面板挂载
    var PANEL_VIEW_SELECTOR = '[data-dsh-reader-view]'
    var CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"]'
    var ACTIVE_ATTR = 'data-dsh-reader-active'
    var OTHER_ACTIVE_ATTRS = ['data-dsh-taskboard-active', 'data-dsh-ssh-active']

    function conversationColumn() {
      return document.querySelector(CONVERSATION_COLUMN_SELECTOR) || undefined
    }

    function mountPanel() {
      var container = null
      var style = null

      var ensure = function () {
        if (container !== null) {
          if (container.isConnected) return
          container.remove()
          container = null
        }
        var column = conversationColumn()
        if (column === undefined) return
        container = document.createElement('div')
        container.dataset.dshReaderView = ''
        column.appendChild(container)
        var chat = buildChat()
        container.appendChild(chat)
        applySettings(loadSettings())
      }

      var waitObserver = new MutationObserver(function () { ensure() })
      waitObserver.observe(document.body, { childList: true, subtree: true })

      var onOtherActivate = function (event) {
        var name = event.detail
        if (name !== 'reader' && state.open) closePanel()
      }
      document.addEventListener('dsh-panel-activate', onOtherActivate)

      var onClickSidebarRow = function (event) {
        if (!state.open) return
        var target = event.target
        if (!(target instanceof HTMLElement)) return
        if (target.closest('[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]') !== null) closePanel()
      }
      document.addEventListener('click', onClickSidebarRow, true)

      ensure()

      return function () {
        document.removeEventListener('dsh-panel-activate', onOtherActivate)
        document.removeEventListener('click', onClickSidebarRow, true)
        waitObserver.disconnect()
        document.documentElement.removeAttribute(ACTIVE_ATTR)
        if (state.pollTimer !== null) { clearTimeout(state.pollTimer); state.pollTimer = null }
        if (container !== null) container.remove()
        if (style !== null) style.remove()
      }
    }

    // ======================================================== 侧边栏入口
    var FAMILY_SELECTOR = '[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-api-balance-entry]'
    var ENTRY_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3.5c2.5 0 3.5-1.2 6-1.2s3.5 1.2 6 1.2v9.4c-2.5 0-3.5-1.2-6-1.2s-3.5 1.2-6 1.2z"/><path d="M8 2.3v10.6"/></svg>'

    function sidebarRoot() {
      var column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]')
      if (column === null) return undefined
      var logoOwner = column.querySelector('[class*="logoRow"]') && column.querySelector('[class*="logoRow"]').parentElement
      return logoOwner || (column.firstElementChild || undefined)
    }

    function newSessionButton(root) {
      var nested = root.querySelector('button[class*="newSession"]')
      if (nested !== null) return nested
      for (var i = 0; i < root.children.length; i++) {
        var child = root.children[i]
        if (child.tagName === 'BUTTON') return child
      }
      return undefined
    }

    function createEntry() {
      var entry = document.createElement('button')
      entry.type = 'button'
      entry.dataset.dshReaderEntry = ''
      entry.className = 'rdr-entry'
      entry.setAttribute('aria-label', '阅读器')
      entry.setAttribute('title', '阅读器')
      entry.innerHTML = '<span class="rdr-entryIcon">' + ENTRY_ICON + '</span><span class="rdr-entryLabel">阅读器</span>'
      entry.addEventListener('click', function () {
        if (state.open) closePanel()
        else openPanel()
      })
      return entry
    }

    function placeEntry(root, entry) {
      var button = newSessionButton(root)
      if (button === undefined) return false
      if (entry.parentElement !== root) {
        var row = button.closest('[class*="logoRow"]')
        var base = row !== null && row.parentElement === root ? row : button
        var family = Array.from(root.children).filter(function (el) {
          return el instanceof HTMLElement && el.matches(FAMILY_SELECTOR)
        })
        var anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
        root.insertBefore(entry, anchor)
      }
      return true
    }

    function mountSidebarEntry() {
      var entry = createEntry()
      var root
      var placed = false
      var rootObserver

      var tryPlace = function () {
        if (root !== undefined && !root.isConnected) {
          if (rootObserver !== undefined) rootObserver.disconnect()
          root = undefined
          placed = false
        }
        if (placed) {
          if (document.body.contains(entry)) return
          if (rootObserver !== undefined) rootObserver.disconnect()
          root = undefined
          placed = false
        }
        root = root || sidebarRoot()
        if (root === undefined) return
        placed = placeEntry(root, entry)
        if (placed) {
          rootObserver = new MutationObserver(function () {
            if (root === undefined || !root.isConnected) {
              placed = false
              tryPlace()
              return
            }
            if (!root.contains(entry)) placed = placeEntry(root, entry)
          })
          rootObserver.observe(root, { childList: true, subtree: true })
        }
      }

      var waitObserver = new MutationObserver(function () { tryPlace() })
      waitObserver.observe(document.body, { childList: true, subtree: true })
      tryPlace()

      return function () {
        waitObserver.disconnect()
        if (rootObserver !== undefined) rootObserver.disconnect()
        entry.remove()
      }
    }

    // ================================================================= apply
    /**
     * 挂载阅读器：侧边栏入口 + 聊天伪装面板。
     * @param ctx - client 根上下文。
     */
    function apply(ctx) {
      var style = document.createElement('style')
      style.dataset.dshReaderCss = ''
      style.textContent = CSS

      var disposers = []
      try {
        document.head.appendChild(style)
        disposers.push(mountSidebarEntry())
        disposers.push(mountPanel())
        // 初次打开时的欢迎消息在首次 openPanel 时注入（buildChat 后）
      } catch (error) {
        console.warn('[dsh-reader] mount failed:', error)
        for (var i = 0; i < disposers.length; i++) disposers[i]()
        style.remove()
        return
      }

      ctx.effect(function () {
        return function () {
          for (var i = 0; i < disposers.length; i++) disposers[i]()
          style.remove()
        }
      }, 'dsh-reader: ui mounts')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
