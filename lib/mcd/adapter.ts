import { couponsForMeal, parseCoupons, toolPayload } from './coupons';
import type { Meal } from '@/lib/types/index';

type JsonRpc = { jsonrpc: '2.0'; id: number; result?: any; error?: { code: number; message: string } };
const MCP_URL = 'https://mcp.mcd.cn';
const token = () => process.env.MCD_MCP_TOKEN?.trim();

async function rpc(body: Record<string, unknown>, sessionId?: string) {
  const headers: Record<string,string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (token()) headers.authorization = `Bearer ${token()}`;
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const response = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: 'no-store' });
  const nextSession = response.headers.get('mcp-session-id') ?? sessionId;
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
  const jsonLine = text.split('\n').find((line) => line.startsWith('data: '))?.slice(6) ?? text;
  let parsed: JsonRpc;
  try { parsed = JSON.parse(jsonLine); } catch { throw new Error('MCP returned an unreadable response'); }
  if (parsed.error) throw new Error(`MCP ${parsed.error.code}: ${parsed.error.message}`);
  return { result: parsed.result, sessionId: nextSession };
}

function embeddedJson(text: string): any | null {
  const start = text.indexOf('{"success"');
  if (start < 0) return null;
  for (let end = text.lastIndexOf('}'); end > start; end--) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
  return null;
}
function resultData(result: any): any {
  const structured = result?.structuredContent ?? result;
  if (structured?.data) return structured.data;
  const text = (result?.content ?? []).map((c:any)=>c.text ?? '').join('\n');
  return embeddedJson(text)?.data ?? null;
}

export async function discoverMcpTools() {
  if (!token()) return { live: false, tools: [], reason: 'MCD_MCP_TOKEN 未配置' };
  const init = await rpc({ jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2025-03-26', capabilities:{}, clientInfo:{ name:'McCourt', version:'0.1.0' } } });
  const listed = await rpc({ jsonrpc:'2.0', id:2, method:'tools/list', params:{} }, init.sessionId);
  return { live: true, tools: (listed.result?.tools ?? []).map((t:any) => ({ name:t.name, description:t.description, inputSchema:t.inputSchema })), sessionId:init.sessionId };
}


function nutritionRows(result: any): Array<{name:string; calories:number; protein:number}> {
  const data = resultData(result);
  const text = typeof data === 'string' ? data : '';
  return text.split('\n').slice(1).map((line) => {
    const parts = line.trim().split(',');
    if (parts.length < 5) return null;
    const calories = Number(parts[3]);
    const protein = Number(parts[4]);
    return Number.isFinite(calories) && Number.isFinite(protein) ? { name:parts[0], calories, protein } : null;
  }).filter(Boolean) as Array<{name:string; calories:number; protein:number}>;
}

function toMeal(raw: any, tags: string[] = []): Meal | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = raw.name ?? raw.productName ?? raw.title ?? raw.itemName;
  if (!name) return null;
  const priceRaw = raw.currentPrice ?? raw.price ?? raw.salePrice ?? raw.amount;
  const caloriesRaw = raw.calories ?? raw.energy;
  const proteinRaw = raw.protein ?? raw.proteinGrams;
  const price = typeof priceRaw === 'number' ? priceRaw : (typeof priceRaw === 'string' && /^\d+(\.\d+)?$/.test(priceRaw) ? Number(priceRaw) : null);
  return { id:String(raw.code ?? raw.id ?? raw.productId ?? name), name:String(name), price, calories:typeof caloriesRaw === 'number' ? caloriesRaw : null, protein:typeof proteinRaw === 'number' ? proteinRaw : null, tags:[...tags, ...(Array.isArray(raw.tags) ? raw.tags.map(String) : [])], source:'麦当劳 MCP' };
}

export async function fetchMeals(): Promise<{ meals: Meal[]; live: boolean; warning?: string; updatedAt: string | null; toolName?: string }> {
  if (!token()) return { meals: [], live:false, warning:'MCD_MCP_TOKEN 未配置，当前无法进入实时模式。', updatedAt:null };
  try {
    const discovered = await discoverMcpTools();
    if (!discovered.live) return { meals: [], live:false, warning:discovered.reason, updatedAt:null };
    const session = (discovered as any).sessionId;
    const nearby = await rpc({ jsonrpc:'2.0', id:3, method:'tools/call', params:{ name:'query-nearby-stores', arguments:{ beType:1, searchType:2, city:'北京', keyword:'朝阳' } } }, session);
    const stores = resultData(nearby.result) ?? [];
    const store = (Array.isArray(stores) ? stores : stores.data ?? []).find((s:any)=>s.businessStatus !== false) ?? (Array.isArray(stores) ? stores[0] : null);
    if (!store?.storeCode) return { meals:[], live:true, warning:'已连接 MCP，但未找到可用门店。', updatedAt:new Date().toISOString(), toolName:'query-nearby-stores' };
    const menu = await rpc({ jsonrpc:'2.0', id:4, method:'tools/call', params:{ name:'query-meals', arguments:{ storeCode:String(store.storeCode), orderType:1, beType:1 } } }, nearby.sessionId);
    const data = resultData(menu.result);
    const detailMap = data?.meals ?? {};
    const tagMap = new Map<string,string[]>();
    for (const category of data?.categories ?? []) for (const m of category.meals ?? []) tagMap.set(String(m.code), [...(tagMap.get(String(m.code)) ?? []), ...(m.tags ?? []), category.name]);
    let meals = Object.entries(detailMap).map(([code, value])=>toMeal({ ...(value as any), code }, tagMap.get(code) ?? [])).filter(Boolean) as Meal[];
    try {
      const nutrition = await rpc({ jsonrpc:'2.0', id:5, method:'tools/call', params:{ name:'list-nutrition-foods', arguments:{} } }, menu.sessionId);
      const rows = nutritionRows(nutrition.result);
      meals = meals.map((meal) => {
        const match = rows.find((row) => row.name === meal.name);
        return match ? { ...meal, calories:match.calories, protein:match.protein } : meal;
      });
    } catch { /* nutrition is optional; missing fields stay null and are shown as unavailable */ }
    try {
      const { coupons } = await fetchAvailableCoupons();
      meals = meals.map(meal => ({ ...meal, coupons: couponsForMeal(meal.name, coupons) }));
    } catch { /* Coupon availability must not prevent meal recommendations. */ }
    return { meals, live:true, warning:meals.length ? undefined : '已调用 query-meals，但响应中没有可验证的标准化餐品数据。', updatedAt:new Date().toISOString(), toolName:'query-meals' };
  } catch (error) { return { meals:[], live:true, warning:`MCP 餐品查询失败：${error instanceof Error ? error.message : '未知错误'}`, updatedAt:new Date().toISOString(), toolName:'query-meals' }; }
}

export async function fetchAvailableCoupons() {
  const discovered = await discoverMcpTools();
  if (!discovered.live) throw new Error('领券服务尚未配置。');
  const response = await rpc({ jsonrpc:'2.0', id:6, method:'tools/call', params:{ name:'available-coupons', arguments:{} } }, discovered.sessionId);
  return { coupons: parseCoupons(response.result), sessionId: response.sessionId };
}

export async function claimCoupons(couponName: string) {
  const { coupons, sessionId } = await fetchAvailableCoupons();
  const coupon = coupons.find(item => item.name === couponName);
  if (!coupon) throw new Error('该优惠券当前不可领取，请重新生成推荐。');
  if (coupon.status === 'claimed') return { message: '这张优惠券已领取，可前往麦当劳查看使用条件。', claimed: true };
  const response = await rpc({ jsonrpc:'2.0', id:7, method:'tools/call', params:{ name:'auto-bind-coupons', arguments:{} } }, sessionId);
  const payload = toolPayload(response.result);
  if (payload?.success === false || (payload?.code != null && payload.code !== 200)) throw new Error('领取失败，请稍后重试。');
  // Re-query instead of assuming every coupon succeeded in a partially successful batch.
  const refreshed = await fetchAvailableCoupons();
  const claimed = refreshed.coupons.some(item => item.name === couponName && item.status === 'claimed');
  return { claimed, message: claimed ? '领取成功，可前往麦当劳查看使用条件。' : '已提交一键领券，暂未确认这张券领取成功，请稍后重试或到麦当劳查看。' };
}
