---
name: mccourt
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
3. 复用 `lib/court/recommend.ts` 的 `recommend()`。按每人预算枚举主食、小食、饮品组合，饥饿程度较高时最多两份不同主食，返回最优及最多两个不同备选。评分考虑类别搭配、饥饿程度、诉求、已知营养和预算效率；不声称精确饱腹预测。
4. 缺少价格的条目不进入预算内组合；营养总量仅在所有组成项都有对应字段时计算，否则为 null。套餐保持整体，不推测内容；排除周边、独立酱料与内容不明的任选条目。
5. 生成案件编号、审理意见、逐人推荐和证据来源。
6. 调用 `/api/appeal` 时携带 `participant`、`reason`、`previousItemIds`、`mode`。太贵要求严格更低总价，不够饱要求增加类别估计的食物量；无解时保留原推荐。前端最多三轮，只替换上诉人。

运行网站后，可直接 POST `/api/recommend` 使用相同输入获得结果，无需操作 UI。该 API 与上诉 API 复用上述引擎及实际 MCP Adapter，不另造菜单或价格。

## 输出 Schema

以下仅展示字段形状，不作为实时菜单资料。

```json
{
  "caseNumber":"MC-2026-1234",
  "caseName":"午餐争议案",
  "recommendations":[
    {
      "participantId":"p1",
      "items":[{"id":"4810","name":"薯条","price":14.5,"calories":289,"protein":4,"tags":["小食"],"source":"麦当劳 MCP"}],
      "totalPrice":14.5,
      "calories":289,
      "protein":4,
      "score":80,
      "reason":"示意判词，实际结果由引擎生成",
      "constraints":["预算不足以同时搭配主食、小食和饮品时，说明缺口"],
      "alternatives":[]
    }
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
