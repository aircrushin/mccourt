---
name: mccourt
version: 0.1.0
description: 将多人麦当劳点餐争议转成可验证餐品推荐与趣味法庭判决。
---

# McCourt 麦门法庭

## 适用场景

当用户需要为 1–4 人协调麦当劳点餐、处理预算/口味/饥饿程度/营养目标冲突时使用。技能输出建议与判词，不替用户自动下单。

## 输入格式

```json
{
  "partyName": "周五午餐",
  "participants": [
    {"id":"p1","name":"小王","budget":20,"taste":["我只想省钱"],"goal":"省钱","hunger":3,"request":"越便宜越好"}
  ],
  "mode": "live"
}
```

`mode=live` 必须依赖 `MCD_MCP_TOKEN`；`mode=demo` 只能用于演示并明确标注。

## 实际 MCP 依赖

- `query-nearby-stores`：查找可用门店。
- `query-meals`：获取门店餐品、现价、商品编码和图片。
- `list-nutrition-foods`：补充热量、蛋白质等营养字段。
- 可扩展 `query-store-coupons`、`campaign-calendar`，但不在推荐流程中隐式领券或下单。

## 处理流程

1. 校验参与者数量、预算和诉求。
2. Live 模式连接 `https://mcp.mcd.cn`，动态初始化并调用上述只读工具。
3. 先过滤硬约束，再按口味 30%、目标 25%、预算 20%、饥饿 15%、多样性 10% 评分。
4. 缺少价格或营养字段时保留空值并降低结论确定性，禁止猜测。
5. 生成案件编号、审理意见、逐人推荐和证据来源。
6. 上诉最多三轮，只重算上诉人，其余推荐保持不变。

## 输出 Schema

```json
{
  "caseNumber":"MC-2026-1234",
  "caseName":"午餐争议案",
  "recommendations":[
    {"participantId":"p1","meal":{"name":"薯条","price":14.5,"calories":289,"protein":4,"source":"麦当劳 MCP"},"reason":"..."}
  ],
  "live":true,
  "sourceUpdatedAt":"2026-10-24T07:00:00.000Z"
}
```

## 错误处理

- Token 缺失、MCP 超时、工具未发现或返回不可解析数据时，返回明确警告。
- 不把演示数据标为实时数据。
- 不调用 `create-order`、`auto-bind-coupons` 等有外部副作用的工具。

## 示例

用户说：“我和两个朋友点麦当劳，一个预算 20 元，一个想多吃鸡肉，一个想控制热量但必须有薯条。”技能应读取实时餐品后，给出每人可验证的价格/营养字段，无法满足时解释缺口，并生成轻度戏剧化判词。
