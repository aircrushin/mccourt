# Codex 开发记录

日期：2026-10-24（北京时间）

## 已完成的真实操作

- 检查当前工作目录，确认起始目录没有现成 Next.js 项目和 Git 仓库。
- 确认 Node.js `v22.16.0` 与 npm `10.9.2` 可用。
- 配置麦当劳官方远程 MCP：`https://mcp.mcd.cn`。
- 使用已授权 Token 对 MCP 初始化请求做了真实连通性检查，服务返回 HTTP 200。
- 查阅麦当劳官方活动仓库中的 `CONTEST_DECLARATION.md` 原文并保留原格式。
- 查阅 WaytoAGI 官方活动页的截止时间信息。

## 进行中

- Next.js App Router 前端与 API
- MCP Tool 动态发现和服务端 Adapter
- 推荐引擎、上诉和判决书数据结构
- 单元测试、端到端测试和移动端验收

## 记录规则

只记录实际执行过的命令、测试和外部调用。未完成的部署、公开仓库、赛事报名和视频录制不会写成已完成。

## 2026-10-24 15:14–15:16

- 完成 Next.js App Router MVP，移动端优先视觉与开庭/判决/上诉流程。
- 完成官方 MCP 适配器，真实调用 `query-nearby-stores`、`query-meals`、`list-nutrition-foods`。
- 真实 API 验证返回 live=true、35 个工具、88 个餐品，推荐结果带价格/营养来源字段。
- 修复推荐引擎多样性评分测试，补充 Playwright 核心流程测试。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npx playwright test --reporter=line` 均通过。

## 2026-10-24 20:37–20:39

- 将 Next.js 从 15.5.x 升级到 16.4.3，并同步 React 19.3.1、React DOM 19.3.1、eslint-config-next 16.4.3 与 React 类型包。
- 接受 Next.js 16 自动更新的 TypeScript 配置：React automatic JSX runtime 与 `.next/dev/types` 类型目录。
- Next.js 16 默认使用 Turbopack；现有 `next dev` / `next build` 脚本无需额外参数。
- 升级后 lint、类型检查、5 个单元测试、Playwright 核心流程和生产构建均通过。

## 2026-10-25 线上 AI 验证与修复

- 通过 Chrome 电脑操作走通生产站点录入、开庭和判决流程；另对生产 API 发起真实请求并检查 Vercel Runtime Logs。
- 发现原 OpenRouter 调用静默降级：先修复非 Latin1 HTTP Header，再依据真实 HTTP 400 日志将动态键结构改为数组。
- 结构修复后发现 8 秒超时；核对 OpenRouter 模型元数据确认默认开启深度思考，关闭后重新部署。
- 北京时间 10:55 复测成功：MCP 88 餐品，OpenRouter 真实生成“薯条预算案”，HTTP 200 / 10.68 秒。
- 增加真实生成来源标识与脱敏失败日志；8 项单元测试、类型检查、lint、生产构建通过。
- 修复已提交 GitHub main 并从绑定仓库部署到 Vercel Production；未执行任何比赛报名操作。

## 2026-10-25 组合推荐升级

- 将当前网站实际使用的 `lib/court/recommend.ts` 从逐人单品选择改为预算内的主食、小食、饮品组合，支持较饿时第二份不同主食；金额按分核算。
- 返回每人总价、完整营养合计、两个可采用的备选和限制说明；备选优先提供便宜方案与不同主食。判决页增加逐项来源、余额和全桌合计。
- 上诉保留原始诉求并按组合重算，太贵要求严格降价，不够饱要求增加类别估计的食物量；无解保留原方案。
- AI 接收组合清单与总价；切换组合后页面及分享使用更新后的方案，避免沿用旧金额判词。
- 营养改为名称精确匹配，避免把单品营养套用给套餐。
- 22 项单元/接口测试、2 项 Playwright 流程测试通过；真实 MCP 88 项餐品参与组合测试。
- 初次浏览器测试在已有服务上失败，改用独立 3100 端口后通过；修复测试选择器对隐藏备选的重复匹配。
- McCourt Skill 输出格式同步升级并通过验证器。

- 组合版已提交 `9186141` 并部署到 Vercel Production；真实 MCP + OpenRouter 组合推荐验证成功（HTTP 200，12.49 秒），两人预算分别 50/70 元，结果 45/70 元；真实上诉将 45 元组合改为 33.5 元。
