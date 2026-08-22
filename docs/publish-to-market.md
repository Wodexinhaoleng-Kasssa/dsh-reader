# 发布到插件市场（awesome-dsh-plugin）指南

> 依据 https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md
> 市场本体：[dsh-market](https://github.com/dsh-market/dsh-market)（awesome 列表是数据源，合并后市场自动重建）

## 0. 现状对照（已达标 / 待补）

| 要求 | 状态 |
| --- | --- |
| 真实可用的代码 + cordis.patch.yml + dsh.bundle | ✅ 已有（CI 第 2 项 dsh.bundle 通过） |
| GitHub 仓库 | ❌ 需要创建并推送 |
| 仓库创建 ≥ 1 天 | ❌ 建仓后等 1 天 |
| 提交数 ≥ 10 | ❌ 当前 5 个（继续开发累积或合理拆分） |
| 仓库添加 `dsh-plugin` topic | ❌ 建仓后在 GitHub 设置里加 |
| 描述属实（维护者会对照代码） | ✅ 文案见下，如实描述 |
| 官方 @deepseek-ai/* 用 peerDependencies | ✅ 本插件无官方依赖，无需处理 |
| npm 发布（可选，推荐） | ❌ 未发布（见第 4 节） |
| 截图（可选） | ❌ assets/ 目录待建（用户截图） |

## 1. 建 GitHub 仓库并推送

```bash
# 在 GitHub 建空仓库（如 <you>/dsh-reader），然后：
cd D:/AI_task/dsh-reader
git remote add origin https://github.com/<you>/dsh-reader.git
git push -u origin main
# 仓库设置 → Topics → 添加 dsh-plugin
```

提交数不满 10：继续迭代功能（书源管理 UI、本地 TXT 导入、MOBI 等）累积提交，
或把已有工作拆成合理的历史提交；不要为凑数制造空提交。

## 2. 提 PR 到 awesome-dsh-plugin

1. fork `awesome-dsh-plugin/awesome-dsh-plugin`（默认分支 main）
2. 添加一个文件 `data/plugins/<owner>__<repo>.yml`（草稿见下）
3. 重新生成 README：`npm ci && node scripts/generate-readme.mjs`
4. 提交 PR（一个 PR ≤ 3 条；只动自己的条目，勿手改 README）

### data/plugins 草稿

```yaml
url: https://github.com/<owner>/dsh-reader
name: <owner>/dsh-reader
category: usage
description:
  en: 'In-browser novel reader for the dsh web GUI: online book-source search, chapter-by-chapter reading in a chat-style view, and whole-book TXT download.'
  zh: DSH Web GUI 在线小说阅读器：书源搜索、聊天式阅读界面、整本下载 TXT 到本地。
```

- category 选 `usage`（实用功能）或 `ui`（界面增强）均可，维护者会校正，不会打回。
- 描述中英文都要以句号结尾；含 `:` 时加引号（上面 en 已加）。
- 若提供预构建 tarball（npm 未发布时推荐）：加 `tarball: https://github.com/<owner>/dsh-reader/releases/latest/download/dsh-reader.tgz`（必须是 GitHub Release 托管的 https .tgz）。

## 3. 截图（可选但推荐）

市场详情页像 App Store 一样展示截图：

- 仓库内建 `assets/`，放 1-8 张图（https 且必须是 GitHub 托管）。
- PR 时在 `data/screenshots.json` 加：

```jsonc
{
  "https://github.com/<owner>/dsh-reader": [
    "https://raw.githubusercontent.com/<owner>/dsh-reader/main/assets/screenshot-1.png",
    "https://raw.githubusercontent.com/<owner>/dsh-reader/main/assets/screenshot-2.png"
  ]
}
```

不提交也没关系，市场会从 README 自动抽图。

## 4. npm 发布（可选但推荐）

好处：预构建安装免 `allowBuilds` 构建授权；市场按下载量排序。不影响收录。

- 包名：`dsh-reader`（npm 未占用）或你自己的 scope（`@<you>/dsh-reader`）。
  注意 `@linxin666` 是 dsh-web-ui 作者的 scope，不能直接使用。
- `package.json` 必须加 `repository` 字段指向第 1 步的 GitHub 仓库（否则市场不会关联两者）：
  ```json
  "repository": { "type": "git", "url": "https://github.com/<owner>/dsh-reader.git" }
  ```
- 不需要在 yml 里写 npm 字段（自动采集，手写会被拒）。
- 发布命令：`npm publish`（记得先改 name/version，lib 下已含全部产物，files 字段已含 lib）。

## 5. 评审要点（维护者会看）

1. 代码是否与描述一致（不夸大）
2. 分类是否合理（不纠结，维护者会改）
3. 是否真实可用（是）
4. 是否与现有条目重复（无同类阅读器）
5. 源码有无可疑（无——纯本地抓取+下载，书源为公开网页，README 有免责声明）

## 6. 合并后

网站/市场自动重建，无需其他操作。后续更新：改自己的 `data/plugins/<owner>__<repo>.yml` + 重新生成 README + PR（≤3 条）。

## 提醒

- 书源版权：README 已加免责声明（仅供个人学习），描述里不必强调，但代码行为要如实。
- 下载整本到本地是抓取行为，插件市场收录不构成安全审查；保持代码透明（无混淆、无凭据外传）即可。
