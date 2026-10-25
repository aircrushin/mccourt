# McCourt 麦门法庭：MCP 接入说明

## 官方服务

- MCP Server：`https://mcp.mcd.cn`
- 协议：Streamable HTTP
- 认证：`Authorization: Bearer <MCP Token>`
- Token 申请入口：[open.mcd.cn/mcp](https://open.mcd.cn/mcp)

## 本地运行

```bash
cp .env.example .env.local
# 写入 MCD_MCP_TOKEN，不要提交 .env.local
npm install
npm run dev
```

`lib/mcd/adapter.ts` 只在服务端读取 Token，客户端不会接触凭证。

## 已验证的真实工具

2026-10-24 本机真实核验：`initialize` 成功，动态发现 35 个工具。McCourt 推荐链路实际调用：

1. `query-nearby-stores`，北京朝阳、到店自取，获得可用 `storeCode`。
2. `query-meals`，获得门店菜单、名称、商品编码、现价和分类。
3. `list-nutrition-foods`，按餐品名称交叉匹配热量与蛋白质。

其他只读能力和字段记录在 `work/mcp-tools-report.md`。`create-order`、领券和抽奖属于外部副作用，不在推荐流程中自动调用。实时判决生效后，用户可以明确确认，系统才按最近营业门店调用 `calculate-price` 与 `create-order`，并打开返回的支付链接。

## 数据真实性

价格和营养字段只来自 MCP 响应。字段缺失时 UI 显示“暂未获取”。演示模式使用明确标注的本地示例数据，不伪装成实时结果。

## OpenRouter AI 法官（可选）

McCourt 使用 Vercel AI SDK 的 OpenAI-compatible provider 接入 OpenRouter。默认模型为 `qwen/qwen3.7-flash:nitro`，适合中文短文本生成，优先低延迟路由。模型只生成案件名称、审理意见和推荐理由，不接触或改写已验证的价格、餐品名称、营养和来源字段。

填写以下环境变量即可启用：

```bash
OPENROUTER_API_KEY=你的 OpenRouter API Key
OPENROUTER_MODEL=qwen/qwen3.7-flash:nitro
OPENROUTER_SITE_URL=https://mccourt.vercel.app
```

没有 API Key、请求超时或模型返回异常时，服务会自动使用确定性判词，不影响推荐主流程。

### 线上诊断

`POST /api/recommend` 返回 `judge.engine`（`openrouter` / `rules`）、`judge.model` 与降级原因。`judgeModel` 只在模型成功生成并通过结构校验时有值。判词请求使用 ASCII 应用标题、固定结构的理由数组，关闭模型默认深度思考，超时 20 秒，无自动重试。

### 组合推荐数据

推荐返回 `items[]`、`totalPrice`、`calories`、`protein`、`alternatives[]`。组合总价以各组成项的 MCP 已知价格相加，缺价格不参与；营养值使用精确名称匹配，缺任何组成项对应营养时该项合计为 null。模型只接收引擎选出的组合、总价和限制说明，不得改动结构化餐品与金额。
