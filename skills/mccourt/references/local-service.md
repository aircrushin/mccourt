# 自行运行 McCourt 服务

仅在没有可用服务、需要使用自己的 MCP 账户或用户要求本地运行时使用。本步骤克隆完整网站到独立目录；不要假定 skill 安装目录内带有网站源码。

## 启动

准备 Git、Node.js 和 npm。使用 Node.js 22.20 或更高版本，以满足当前 Skills CLI 的运行要求。

```bash
git clone https://github.com/aircrushin/mccourt.git
cd mccourt
npm install
cp .env.example .env.local
```

已有 checkout 时直接进入原目录，避免重复克隆或覆盖已有 `.env.local`。

- 只体验固定案例：`.env.local` 的 Token 留空即可，调用时使用 `mode=demo`。
- 使用实时菜单：从 [麦当劳 MCP 平台](https://open.mcd.cn/mcp) 获取 Token，在本地编辑 `.env.local` 的 `MCD_MCP_TOKEN`。不要把真实 Token 写入对话、skill 或提交记录。
- AI 判词可选：设置 `OPENROUTER_API_KEY`；未配置时使用规则判词，推荐功能仍可用。固定案例也可能使用该模型生成判词，如需避免调用 MCP 和模型服务，两个密钥都留空。

启动 HTTP 服务：

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

保持此终端运行，在另一个终端设置调用地址并检查：

```bash
export MCCOURT_BASE_URL=http://127.0.0.1:3000
curl --fail-with-body --silent --show-error --max-time 10 \
  "${MCCOURT_BASE_URL%/}/api/health"
```

预期包含 `"ok":true` 和 `"service":"mccourt"`。然后执行 [HTTP API 中的 Demo 请求](http-api.md#可直接运行的-demo)，确认 `verdict.live=false` 并显示固定体验资料说明。

## 实时模式

Token 配好并重启服务后，可检查 MCP 初始化和工具发现：

```bash
curl --fail-with-body --silent --show-error --max-time 60 \
  "${MCCOURT_BASE_URL%/}/api/mcd/status"
```

该检查会访问真实 MCP。Live 推荐还需要用户提供的位置；使用同一份 API 输入，将 `mode` 设为 `live` 并传入城市与地标或经纬度。请求成功后仍须检查 `verdict.live`、`warning` 和餐品列表。

## 常见问题

- 端口被占用：改用 `--port 3001`，同时修改 `MCCOURT_BASE_URL`。
- 连接被拒绝：检查服务终端是否仍运行及地址是否一致。远程执行环境的 `127.0.0.1` 指向远程环境，不能自动访问用户电脑。
- MCP Token 未配置或失效：由服务管理员在服务端处理，不将 Token 作为 HTTP 推荐参数传递。
- 健康检查通过但 Live 无结果：检查 MCP 状态、位置、门店与返回警告；健康检查不验证这些依赖。
