/**
 * dsh-reader — host half.
 *
 * 在线小说阅读器的服务端半身：内置书源（移植自 binbyu/Reader 的 bs.json）、
 * 书源抓取引擎（node fetch，规避浏览器 CORS）、/api/dsh-reader 路由族
 * （搜索/章节/正文/整本下载）、下载任务管理（写本地 TXT）。
 */
import { makeRoutes } from './routes.js'

/** 稳定 cordis 插件名。 */
export const name = 'reader'

/** 需要 webServer 服务注册路由。 */
export const inject = ['webServer']

// 注意：不导出 Config。rc.8 加载器会调用 Config.validate()，若导出普通
// 对象会导致崩溃；本插件无配置项，故按 dsh-api-balance 的先例不导出
// Config（需要配置时再用 schemastery 的 z.object）。

/**
 * 自防御：防止插件被"双重启用"（bundles + 根 patch 同时启用）时重复注册
 * /api/dsh-reader 路由导致 dsh web 启动崩溃（duplicate exact route）。
 * Node ESM 模块单例：第二次 apply 看到这里的标志后直接跳过。
 */
let routesApplied = false

/**
 * 挂载书源引擎与路由。
 * @param ctx - host 插件上下文（webServer）。
 */
export function apply(ctx) {
  if (routesApplied) {
    console.warn('[dsh-reader] duplicate apply ignored (插件被重复启用，已跳过路由注册，避免重复路由崩溃)')
    return
  }
  routesApplied = true
  const { routes } = makeRoutes()
  ctx.effect(
    () => {
      const disposers = routes.map((route) => ctx.webServer.register(route))
      return () => {
        for (const dispose of disposers) dispose()
      }
    },
    'dsh-reader: routes',
  )
}
