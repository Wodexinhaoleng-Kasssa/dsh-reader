# dsh-reader · DSH Web GUI 在线小说阅读器

侧边栏「阅读器」入口：在线书源搜索 / 章节抓取 / 整本下载到本地（TXT），
阅读界面**伪装成聊天对话框**——小说章节以一条条对话消息呈现，输入框支持
指令（下一章 / 目录 / 下载 / 设置字号…）。

## 功能

- **在线书源**：内置 41 个书源（合并自 [binbyu/Reader](https://github.com/binbyu/Reader) 的 bs.json
  与 v2.0.0.4 发布包 .bs_bak.json），支持 HTML XPath 与 JSON 路径两种规则、
  UTF-8/GBK 编码识别、章节/内容分页、广告文本过滤。
  实测可用（2026-08）：必去小说（1008 章，正文干净）、玄幻阁（1002 章）、狗狗书籍（1005 章）、
  阅读库 / 笔趣阁yingsx / 蚂蚁文学 / 零零小说 / 唐三中文 / 晋江文学城 等。
- **搜索**：输入书名 → 多书源并发搜索 → 结果以可点击的消息卡片展示。
- **阅读**：点书即读，章节正文作为「对话消息」呈现；下一章 / 上一章 / 第N章 / 目录。
- **书架**：IndexedDB 保存书籍与章节缓存，离线可读；进度自动记忆。
- **下载**：整本抓取拼接为 TXT（UTF-8 BOM），保存到本地（默认 `~/Downloads/dsh-reader`），带进度消息。
- **书源管理**：规则在 `lib/bsdata.js` 中增删；参考原版 `doc/bs.md` 配置说明。

## 本地验证（开发者）

```bash
# 书源可用性测试（会实际请求各书源，需联网）
node scripts/test-sources.mjs 雪中悍刀行

# 可用源的章节+正文链路测试
node scripts/test-chapters.mjs 雪中悍刀行

# 集成测试：临时 http server 挂 /api/dsh-reader 全链路
node test-integration.mjs 雪中悍刀行
```

书源合并脚本：`node scripts/merge-bsdata.mjs`（读取 v2.0.0.4 的 .bs_bak.json + GitHub bs.json 重新生成 `lib/bsdata.js`）。

## 🚀 安装

**前置**：已装好 DSH（dsh web 能正常运行），Node.js ≥ 20、pnpm ≥ 10。

**支持的 DSH 版本**：0.1.0-rc.8 及以上（RC 系列；已在 rc.8 环境实测通过）。

### 方式一：命令行安装

```bash
dsh plugin --profile web add github:Wodexinhaoleng-Kasssa/dsh-reader
```

- 首次安装若被 pnpm 11 拦截构建脚本（依赖写入成功但提示 build 未放行），执行：
  ```bash
  cd ~/.dsh/profiles/web && pnpm approve-builds --all
  ```
  然后重跑一次上面的 add 命令即可。
- 装完**硬刷新浏览器**（Cmd/Ctrl+Shift+R）即可看到左侧边栏的「阅读器」入口（DSH 对 client 改动热加载，无需重启；仅 host 半更新时需要重启）。

> 本插件暂未发布 npm；发布后可直接 `dsh plugin --profile web add @linxin666/dsh-reader`。

### 方式二：让 DSH 自己装

把下面这段提示词发给任意一个 DSH 会话：

```
帮我安装 dsh-reader 插件（DSH Web GUI 在线小说阅读器），步骤：
1. 执行 dsh plugin --profile web add github:Wodexinhaoleng-Kasssa/dsh-reader
2. 若被 pnpm 拦截构建脚本，在 ~/.dsh/profiles/web 下执行 pnpm approve-builds --all 并重跑 add
3. 完成后提醒我硬刷新浏览器（Cmd/Ctrl+Shift+R）
```

### 开发/源码方式

```bash
dsh plugin --profile web add link:<本仓库绝对路径>
```

**注意**：本插件已内置"双重启用自防御"（即使被同时加入 bundles 与插槽，也不会因重复路由导致 dsh web 崩溃），但正常安装仍应只保留一个启用入口。

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

## 致谢与版权

本项目功能思路参考 [binbyu/Reader](https://github.com/binbyu/Reader)（win32 小说阅读器，
MIT 协议之外的作者自有版权声明：分享/推广需注明出处、严禁非法与商业用途）。
本插件**未复制其任何 C++ 源码**，全部代码为 TypeScript/JavaScript 独立重写；
内置书源规则数据（xpath 配置）来自其公开的 bs.json / .bs_bak.json，仅作学习参考。

本插件为免费开源的**非商业**用途软件，遵守原作者"注明出处、禁止商业用途"的要求；
若原作者对书源数据的使用有异议，请联系移除。

## 免责声明

书源网站随时可能失效/改版（原版 README 同样警告）；内置书源仅为功能演示，
请尊重各网站版权，下载内容仅限个人学习使用。
