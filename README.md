# McCourt 麦门法庭

> 吃什么吵不明白？交给麦门大法官。

McCourt 是一个移动端优先的互动 Web 产品，把多人点餐争论变成 AI 法庭审判。用户录入 1–4 位参与者的预算与诉求，系统调用麦当劳中国官方 MCP 的只读工具，按确定性推荐规则生成逐人餐品建议和趣味判决书。

在线体验：[mccourt.vercel.app](https://mccourt.vercel.app)

## 目标用户

适合需要协调多人点餐的朋友、同事和家庭，也适合独自面对预算、口味和饮食目标取舍的用户。无需登录，由一人录入整桌诉求即可使用。

## 使用示例

1. 点击「立即开庭」，创建饭局并添加参与者。
2. 例如给小王设置预算 20 元、诉求「越便宜越好」；给小李设置预算 35 元、诉求「想补充蛋白质」；给小张设置预算 30 元、诉求「想控制热量，但必须吃薯条」。
3. 点击「咚！开庭！」，服务端查询麦当劳 MCP，生成逐人推荐和趣味判决。可获取的价格、营养及来源会随推荐展示；缺失字段保留为空或说明暂未获取。
4. 每位参与者可以服判或提出上诉，全部确认后让判决生效。

「体验示例案件」使用固定案例资料，仅用于流程体验，不代表实时餐品、价格或营养。Live 模式失败时会说明原因，不会静默切换为固定案例。

## 已实现

- 首页品牌与原创汉堡法官
- 1–4 人饭局创建、预算、标签、饥饿程度和自由诉求
- 开庭动画、可跳过、减少动画适配
- Live MCP：门店、菜单价格、营养数据真实调用
- 体验案例：明确标注固定资料及非实时性质
- 硬约束优先的推荐引擎与来源字段
- 判决书、逐人服判、最多三轮上诉、最终生效、复制/分享
- `/api/recommend`、`/api/appeal`、`/api/mcd/status`、`/api/health`
- `skills/mccourt/SKILL.md` 与比赛材料

## 开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

验证：

```bash
npm run typecheck
npm test
npm run build
```

## 部署

项目已部署到 [Vercel](https://mccourt.vercel.app)，并绑定 [GitHub 仓库](https://github.com/aircrushin/mccourt) 的 `main` 分支，推送后自动部署。

自行部署时，在 Vercel 环境变量中设置 `MCD_MCP_TOKEN`。如需 AI 法官文案，再设置 `OPENROUTER_API_KEY`；默认模型为 `qwen/qwen3.7-flash:nitro`。模型密钥未配置或调用失败时使用规则化判词。不要上传 `.env.local` 或真实凭证。

`mcp-config.example.json` 使用 `${MCD_MCP_TOKEN}` 环境变量占位符；导入 MCP 客户端时，需按客户端支持的方式注入凭证，不要将填入真实 Token 的配置提交到仓库。

本项目使用 Codex 开发。比赛报名需另行在官方活动仓库发布报名 Issue，作品部署不等于报名成功。

## 文档

- [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)
- [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md)
- [docs/SUBMISSION_CHECKLIST.md](./docs/SUBMISSION_CHECKLIST.md)
- [docs/TEST_REPORT.md](./docs/TEST_REPORT.md)
