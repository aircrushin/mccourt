# McCourt 测试报告

日期：2026-10-24（北京时间）

## 已执行

- `npm run typecheck`：通过
- `npm test`：通过，5 个推荐引擎测试
- `npm run build`：通过，Next.js 生产构建完成
- 本地浏览器流程：通过，首页 → 创建饭局 → 示例庭审 → 判决书
- 真实 MCP 状态：通过，`GET /api/mcd/status` 返回 live=true、35 个工具
- 真实推荐调用：通过，`POST /api/recommend` 实际调用 `query-nearby-stores`、`query-meals`、`list-nutrition-foods`，返回 88 个餐品并参与推荐
- `npx playwright test --reporter=line`：通过，1 个核心流程用例。

## 尚未执行
- Vercel 远程部署和公开链接尚未执行。
