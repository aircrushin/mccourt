# McCourt HTTP API

所有路径相对选定的服务地址，POST 使用 `Content-Type: application/json`。这些接口无需由调用方提交 MCP Token；实时数据使用服务端配置的账户。以下请求均为推荐或查询，不会创建订单。

## 服务检查

- `GET /api/health`：返回 `{ "ok": true, "service": "mccourt", "time": "..." }`，仅确认网站可达。
- `GET /api/mcd/status`：返回 `live`、`toolCount`、`tools`、`reason`。可能调用真实 MCP 的初始化和工具发现；无法连接时可能返回 HTTP 502。连接正常也不保证指定门店有可用菜单。

## 推荐请求

`POST /api/recommend` 的请求示例：

```json
{
  "partyName": "周五午餐",
  "participants": [
    {
      "id": "p1",
      "name": "小王",
      "budget": 20,
      "taste": ["我只想省钱"],
      "goal": "省钱",
      "hunger": 3,
      "request": "越便宜越好"
    }
  ],
  "mode": "live",
  "location": { "city": "北京", "keyword": "朝阳大悦城" }
}
```

示例地点只说明结构，实际调用使用用户提供的位置。`location` 也可为 `{ "latitude": 39.9, "longitude": 116.4 }`，经纬度须成对提供。API 允许不传 `location`，但实时选店需要位置；省略时可能返回空推荐及位置警告。

| 字段 | 约束 |
| --- | --- |
| `partyName` | 必填，1–50 字符 |
| `participants` | 必填，1–4 人 |
| `id` | 必填字符串；为准确关联结果，调用方应为每人分配不同值 |
| `name` | 必填，1–30 字符 |
| `budget` | 必填，数字，1–500 元 |
| `hunger` | 必填，1–5 的整数 |
| `taste` | 字符串数组，省略时为空数组 |
| `goal` | 字符串，省略时为空字符串 |
| `request` | 最长 180 字符，省略时为空字符串 |
| `mode` | `live` 或 `demo`，省略时为 `live` |
| `location` | 可选；城市 1–20 字符与地标 1–40 字符，或合法经纬度 |

### 可直接运行的 Demo

终端中设置调用地址，然后发送固定体验请求。Demo 无需 MCP Token，也不代表实时价格；服务若配置了 OpenRouter，仍可能为 Demo 生成 AI 判词。

```bash
export MCCOURT_BASE_URL=http://127.0.0.1:3000
curl --fail-with-body --silent --show-error --max-time 120 \
  "${MCCOURT_BASE_URL%/}/api/recommend" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'JSON'
{
  "partyName": "技能安装验证",
  "participants": [
    {"id":"p1","name":"小王","budget":20,"taste":[],"goal":"省钱","hunger":3,"request":"越便宜越好"}
  ],
  "mode": "demo"
}
JSON
```

连接公开体验服务时，将地址改为 `https://mccourt.vercel.app`。Live 请求将 `mode` 改为 `live`，补入用户提供的 `location`，且由服务管理员提前配置 MCP Token。

### 推荐响应

响应外层为 `{ verdict, toolName, mealCount, judgeModel, judge }`，推荐不在响应顶层。主要字段如下：

| 路径 | 含义 |
| --- | --- |
| `verdict.caseNumber`、`verdict.caseName` | 案件编号与名称 |
| `verdict.opening`、`verdict.opinions`、`verdict.ruling` | 开场、审理意见、判词 |
| `verdict.recommendations[]` | 每人推荐，以 `participantId` 关联输入 |
| `verdict.recommendations[].items[]` | 餐品的 `id`、`name`、`price`、`calories`、`protein`、`tags`、`source`，可含 `coupons` |
| `verdict.recommendations[].totalPrice` | 组合总价；无可行组合时可为 `null` |
| `verdict.recommendations[].calories`、`.protein` | 对应营养总量，缺少任一组成项数据时为 `null` |
| `verdict.recommendations[].score`、`.reason`、`.constraints` | 引擎评分、推荐理由和限制 |
| `verdict.recommendations[].requestMatch` | 可选；包含 `satisfied`、`issues` 等诉求匹配信息 |
| `verdict.recommendations[].alternatives[]` | 最多两个备选，含组合餐品、价格、营养和理由 |
| `verdict.live`、`verdict.sourceUpdatedAt`、`verdict.warning` | 实时标记、数据时间、警告；Demo 时间为 `null` |
| `verdict.store` | 门店信息或 `null`，包含 `storeCode`、`storeName`、`address`、`distance` |
| `verdict.orderPermit` | 网站下单流程使用的凭据或 `null`，本 skill 忽略 |
| `judge` | 文案引擎信息；`engine=rules` 表示规则判词，不等于数据为 Demo |

预算余额用输入预算减 `totalPrice`；总价为 `null` 时不计算。不要将 `mealCount>0` 或 HTTP 200 当作实时成功，必须结合 `verdict.live`、警告和实际餐品判断。

## 单人上诉

`POST /api/appeal`：

```json
{
  "participant": {
    "id": "p1",
    "name": "小王",
    "budget": 20,
    "taste": [],
    "goal": "省钱",
    "hunger": 3,
    "request": "越便宜越好"
  },
  "reason": "太贵",
  "previousItemIds": [],
  "mode": "demo"
}
```

`participant` 使用原参与者信息；`previousItemIds` 应填当前组合所有 `items[].id`，最多 6 个。示例空数组仅说明字段形状，缺少历史 ID 会失去与原组合的严格比较。`reason` 为 1–180 字符。

实时上诉应附加原判决的 `storeCode`，保持同一家门店；保持原 `mode`。返回字段为 `{ recommendation, live, updatedAt, warning, orderPermit, message }`，没有 `verdict` 包装。新推荐 `items` 为空时保留原方案并展示 `message` 或限制说明。每人最多三轮由 skill 维护，接口不计轮数。

当原组合能被当前菜单完整验证时，原因包含“太贵”会要求新总价严格更低，包含“不够饱”会要求增加类别估计的食物量。无法验证原组合时，不保证严格比较，需告知用户。本 skill 不使用可选的 `orderPermit`。

## 失败处理

- HTTP 400：请求校验失败；检查 `error` 和可能存在的 `details`，修正输入后再试。
- HTTP 500、超时、非 JSON 或响应结构异常：说明服务错误，不编造推荐；重复失败时停止重试。
- HTTP 200 但 `live=false`、空 `items` 或带警告：按实际原因解释。请求为 Live 时不能将失败描述成成功获得固定体验推荐，也不静默重发 Demo。
- 上诉的 `live=true` 也可能伴随空菜单或查询失败警告；仍须检查 `warning` 和 `recommendation.items`。
