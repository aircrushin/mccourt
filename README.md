# McCourt 麦门法庭

> 吃什么吵不明白？交给麦门大法官。

McCourt 是一个移动端优先的互动 Web 产品，把多人点餐争论变成 AI 法庭审判。用户录入 1–4 位参与者的预算与诉求，系统调用麦当劳中国官方 MCP 的只读工具，按确定性推荐规则生成逐人餐品建议和趣味判决书。

## 已实现

- 首页品牌与原创汉堡法官
- 1–4 人饭局创建、预算、标签、饥饿程度和自由诉求
- 开庭动画、可跳过、减少动画适配
- Live MCP：门店、菜单价格、营养数据真实调用
- Demo 模式：明确标注演示数据
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

目标平台是 Vercel。部署前在项目环境变量中设置 `MCD_MCP_TOKEN`。如需 AI 法官文案，再设置 `OPENROUTER_API_KEY`；默认模型为 `qwen/qwen3.7-flash:nitro`。不要上传 `.env.local`。部署和报名需要用户手动完成，当前仓库未自动发布。

## 文档

- [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)
- [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md)
- [docs/SUBMISSION_CHECKLIST.md](./docs/SUBMISSION_CHECKLIST.md)
- [docs/TEST_REPORT.md](./docs/TEST_REPORT.md)
