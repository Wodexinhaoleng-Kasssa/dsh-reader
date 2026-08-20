# dsh-reader · DSH Web GUI 在线小说阅读器

侧边栏「阅读器」入口：在线书源搜索 / 章节抓取 / 整本下载到本地（TXT），
阅读界面**伪装成聊天对话框**——小说章节以一条条对话消息呈现，输入框支持
指令（下一章 / 目录 / 下载 / 设置字号…）。

## 功能

- **在线书源**：内置 13 个书源（移植自 [binbyu/Reader](https://github.com/binbyu/Reader) 的 bs.json），
  支持 HTML XPath 与 JSON 路径两种规则、UTF-8/GBK 编码识别、章节/内容分页、广告文本过滤。
- **搜索**：输入书名 → 多书源并发搜索 → 结果以可点击的消息卡片展示。
- **阅读**：点书即读，章节正文作为「对话消息」呈现；下一章 / 上一章 / 第N章 / 目录。
- **书架**：IndexedDB 保存书籍与章节缓存，离线可读；进度自动记忆。
- **下载**：整本抓取拼接为 TXT（UTF-8 BOM），保存到本地（默认 `~/Downloads/dsh-reader`），带进度消息。
- **书源管理**：规则在 `lib/bsdata.js` 中增删；参考原版 `doc/bs.md` 配置说明。

## 安装（本地 link 方式）

```bash
# 1. 在 web profile 的 package.json dependencies 中加入：
#    "@linxin666/dsh-reader": "link:D:/AI_task/dsh-reader"
# 2. 在 ~/.dsh/cordis.patch.yml 加入：
#    - insert:
#        - id: reader
#          name: '@linxin666/dsh-reader'
# 3. 安装依赖并重启 dsh web：
cd ~/.dsh/profiles/web && pnpm install
```

也可用：`dsh plugin --profile web add link:<本包绝对路径>`（等价于上面两步）。

## 架构

- `lib/index.js` — host 半身：注册 /api/dsh-reader 路由（loopback-only）。
- `lib/engine.js` — 书源引擎：node fetch 抓取（规避浏览器 CORS）、编码识别、XPath/JSON 提取。
- `lib/xpath.js` — XPath 子集（`//`、`[@attr='v']`、`[position()>1]`、`/@href`、`|` 联合）+ JSON 路径。
- `lib/bsdata.js` — 内置书源数据（原版 bs.json 移植）。
- `lib/downloads.js` — 整本下载任务（进度/取消/写盘）。
- `lib/client.js` — 浏览器半身：侧边栏入口 + 聊天伪装阅读 UI + IndexedDB 书架。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/dsh-reader/sources | 书源列表 |
| POST | /api/dsh-reader/search | {keyword} → 多源搜索结果 |
| POST | /api/dsh-reader/chapters | {source,url} → 章节列表 |
| POST | /api/dsh-reader/content | {source,url} → 单章正文 |
| POST | /api/dsh-reader/download | 创建整本下载任务 → {taskId} |
| GET | /api/dsh-reader/download?id= | 任务进度/结果 |
| POST | /api/dsh-reader/download/cancel | 取消任务 |

## 免责声明

书源网站随时可能失效/改版（原版 README 同样警告）；内置书源仅为功能演示，
请尊重各网站版权，下载内容仅限个人学习使用。
