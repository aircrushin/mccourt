# McCourt 测试报告

日期：2026-10-24（北京时间）

框架版本：Next.js 16.4.3，React 19.3.1

## 已执行

- `npm run typecheck`：通过
- `npm test`：通过，5 个推荐引擎测试
- `npm run build`：通过，Next.js 生产构建完成
- 本地浏览器流程：通过，首页 → 创建饭局 → 示例庭审 → 判决书
- 真实 MCP 状态：通过，`GET /api/mcd/status` 返回 live=true、35 个工具
- 真实推荐调用：通过，`POST /api/recommend` 实际调用 `query-nearby-stores`、`query-meals`、`list-nutrition-foods`，返回 88 个餐品并参与推荐
- `npx playwright test --reporter=line`：通过，1 个核心流程用例。

## 2026-10-25 线上 AI 实测

- 生产域名：https://mccourt.vercel.app
- 已部署代码：`a19ebb3`；Vercel deployment `dpl_9qqrReMjuGa77HpmE3VdXf8T9ueU`，状态 READY，生产域名已绑定。
- 北京时间 10:55，真实 `POST /api/recommend`（mode=live）返回 HTTP 200，耗时 10.68 秒。
- MCP 返回 88 个餐品，`toolName=query-meals`，推荐薯条 14.5 元、289 kcal、蛋白质 4 g，来源为 MCP，本次预算 20 元。
- `judge.engine=openrouter`，`judge.model=qwen/qwen3.7-flash:nitro`，实际生成案件名“薯条预算案”及新判词，并非规则化降级。
- 初测暴露三个问题：中文 HTTP Header 导致 ByteString 错误；动态键 JSON Schema 被模型服务拒绝（400）；默认深度思考超过 8 秒超时。已分别改为 ASCII Header、固定结构数组、关闭深度思考并设置 20 秒超时。
- API 现在仅在 AI 生成成功时返回模型名，失败明确报告 `judge.engine=rules`，服务端保留脱敏诊断。
- 修复后 `npm test` 通过 8 项测试（含 3 项 AI 调用/降级测试），`npm run typecheck`、`npm run lint`、`npm run build` 均通过。
- 原始脱敏请求/响应证据：`outputs/online-ai-test-final.json`。
- 本次没有重新执行 Playwright；修复期间使用电脑操作完成线上浏览器录入、真实 MCP 开庭与判决页面检查（该轮 AI 仍降级）。最终修复通过生产 API 验证；修复后的浏览器重测受电脑工具连接超时影响，未完成最终判词截图，不将该截图视为通过证据。

## 2026-10-25 组合推荐升级

- `npm test`：22 项通过，其中包含 10 项当前组合引擎测试、4 项上诉 API 测试、3 项 AI 调用测试、5 项原有测试。
- `PLAYWRIGHT_PORT=3100 OPENROUTER_API_KEY='' npx playwright test --reporter=line`：2 项通过，覆盖体验案例与 390px 手机端组合、采用备选、上诉降价、其他参与者保持不变、总价和无横向溢出。该 E2E 使用固定体验资料，不作为实时 MCP 或模型成功证据。
- 真实 MCP 适配器测试返回 88 个餐品，当前引擎用真实价格生成组合并通过预算与总价一致性断言。
- 组合截图：`outputs/combinations-mobile.png`。
- 最终 `npm run lint`、`npm run typecheck`、`npm run build` 均通过。
- Production 已部署 `9186141`，Vercel `dpl_F1sy3bMjdrEA82HxYsM224pYS6m9` 状态 READY，生产域名已绑定。
- 2026-10-25T11:11:59.395714+08:00 真实生产组合请求：HTTP 200，12.49 秒，MCP 88 餐品，`judge.engine=openrouter`，模型 `qwen/qwen3.7-flash:nitro`。
- 50 元预算：枫糖风味厚松饼猪柳堡 + 薯条 + 雪碧，总价 45 元；备选 33.5 元（不含饮品）与 45.5 元（更换主食），均在预算内。
- 70 元、饥饿程度 5：双层吉士汉堡 + 麦香鸡 + 脆薯饼 + 黄金橙橙，总价 70 元；预算与组成项总价一致性断言通过。
- 真实生产“太贵了”上诉：HTTP 200，5.66 秒，由 45 元降为 33.5 元，未虚构优惠或价格。
- 原始脱敏响应证据：`outputs/combinations-online-test.json`。
