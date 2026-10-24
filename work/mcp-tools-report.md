# 麦当劳官方 MCP 工具核查记录

核查时间：2026-10-24（本机北京时间）
服务端：`https://mcp.mcd.cn`
协议：Streamable HTTP
认证：本机 Codex 配置中的 Bearer Token（本文不记录 Token）

## 连接与真实调用

- `initialize`：HTTP 200，serverInfo=`mcd-mcp` v1.0.0，协议版本 `2025-03-26`。
- `tools/list`：HTTP 200，动态发现 **35 个工具**。
- `query-nearby-stores`：真实调用成功，参数 `beType=1, searchType=2, city=北京, keyword=朝阳`，返回 5 家营业门店及 `storeCode`、地址、营业时间和预约时段。
- `query-meals`：真实调用成功，参数 `storeCode=1950538, orderType=1, beType=1`，返回菜单分类、餐品名称、商品编码、现价/原价和图片 URL。
- `list-nutrition-foods`：真实调用成功，返回营养数据列表。
- `campaign-calendar`：真实调用成功，返回活动日历。

## 已发现工具

- `query-party-store-session`：必填参数 `spuId, storeCode, dateStr`。
- `query-nearby-stores`：必填参数 `beType, searchType`。
- `query-meal-assistance`：必填参数 `storeCode`。
- `query-party-city`：必填参数 `spuId`。
- `auto-bind-coupons`：必填参数 `无`。
- `query-store-coupons`：必填参数 `orderType, beType, storeCode`。
- `create-order`：必填参数 `storeCode, orderType, beType`。
- `calculate-price`：必填参数 `storeCode, orderType, beType`。
- `query-my-prizes`：必填参数 `无`。
- `query-party-store-date`：必填参数 `spuId, storeCode`。
- `available-coupons`：必填参数 `无`。
- `cancel-order`：必填参数 `orderId, cancelReasonCode`。
- `now-time-info`：必填参数 `无`。
- `delivery-create-address`：必填参数 `address, addressDetail, city, contactName, phone`。
- `delivery-query-addresses`：必填参数 `无`。
- `query-promotions`：必填参数 `storeCode, orderType, beType`。
- `query-my-coupons`：必填参数 `无`。
- `list-nutrition-foods`：必填参数 `无`。
- `draw-lottery`：必填参数 `无`。
- `mall-product-detail`：必填参数 `spuId`。
- `mall-order-list`：必填参数 `无`。
- `query-party-store`：必填参数 `code`。
- `delivery-query-stores`：必填参数 `beType, addressId`。
- `mall-order-detail`：必填参数 `orderId`。
- `party-order-create`：必填参数 `partyType`。
- `query-meal-detail`：必填参数 `storeCode, orderType, beType, code`。
- `query-my-account`：必填参数 `无`。
- `mall-points-products`：必填参数 `无`。
- `query-survey-coupon`：必填参数 `orderId`。
- `query-lottery-info`：必填参数 `无`。
- `mall-create-order`：必填参数 `skuId, spuCategory`。
- `query-meals`：必填参数 `storeCode, orderType, beType`。
- `campaign-calendar`：必填参数 `无`。
- `query-order`：必填参数 `orderId`。
- `order-list`：必填参数 `无`。

## 推荐引擎可用的事实来源

- 门店：`query-nearby-stores`（需要城市/关键词或收藏门店；到店自取 `beType=1`，得来速 `beType=5`）。
- 菜单与价格：`query-meals`（需要 `storeCode`、`orderType`、`beType`；返回 `currentPrice`、`originalPrice`、`name`、`code`、`image`、分类和标签）。
- 餐品详情/套餐组成：`query-meal-detail`（需要门店、订单类型、取餐类型、餐品 code）。
- 营养：`list-nutrition-foods`（无参数；返回能量、蛋白质、脂肪、碳水、钠、钙等字段的餐品营养列表）。
- 实际含优惠的价格：`calculate-price`（需要商品 code/数量以及门店和订单参数；返回金额单位为分，不能用菜单标价替代）。
- 门店可用优惠：`query-store-coupons`；用户券包：`query-my-coupons`；活动：`campaign-calendar`。
- 下单：`create-order`，属于有外部副作用的能力，McCourt MVP 不自动调用。

## 实现注意

- 官方工具不提供统一“热量字段”挂在菜单项上，营养必须从 `list-nutrition-foods` 交叉匹配；匹配不到时展示“暂未获取”。
- 菜单价格是门店/订单类型相关，推荐结果应保留 `storeCode`、`orderType`、`beType` 和调用时间。
- 到店自取不传 `beCode`；得来速、外送、团餐按工具说明必须传 `beCode`。
- `create-order` 和领券/抽奖等工具会改变外部状态，必须由用户明确触发，不能在推荐流程隐式调用。
- 图片 URL 由官方 MCP 返回，项目应把来源标为“麦当劳 MCP 返回”，不把图片当作本地原创素材。
