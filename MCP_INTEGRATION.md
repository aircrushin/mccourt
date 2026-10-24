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

其他只读能力和字段记录在 `work/mcp-tools-report.md`。`create-order`、领券和抽奖属于外部副作用，不在 MVP 中自动调用。

## 数据真实性

价格和营养字段只来自 MCP 响应。字段缺失时 UI 显示“暂未获取”。演示模式使用明确标注的本地示例数据，不伪装成实时结果。
