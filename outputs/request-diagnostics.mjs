import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const location = { city: '上海', keyword: '人民广场' };
const cases = [
  { id: 'baseline', request: '', expected: [] },
  { id: 'burger-sprite', request: '我要汉堡和雪碧', expected: ['主食', '雪碧'] },
  { id: 'grilled-short', request: '我要吃板烧', expected: ['板烧'] },
  { id: 'grilled-sprite', request: '我要吃板烧鸡腿堡和雪碧', expected: ['板烧', '雪碧'] },
  { id: 'fish', request: '我要吃麦香鱼', expected: ['麦香鱼'] },
  { id: 'burger-coke', request: '我要汉堡和可乐', expected: ['主食', '可乐'] },
  { id: 'fries-positive', request: '我要吃薯条', expected: ['薯条'] },
  { id: 'fries-negative', request: '不要薯条，要板烧和雪碧', expected: ['板烧', '雪碧'], forbidden: ['薯条'] },
  { id: 'no-drink', request: '不喝饮料，要板烧', expected: ['板烧'], forbidden: ['饮品'] },
  { id: 'sprite-only', request: '只要一杯雪碧，不要其他食物', expected: ['雪碧'], only: true },
  { id: 'impossible-budget', request: '我要板烧鸡腿堡和雪碧', expected: ['板烧', '雪碧'], budget: 10 },
  { id: 'fries-sprite', request: '我要汉堡、薯条和雪碧', expected: ['主食', '薯条', '雪碧'] },
];
const participant = c => ({ id: c.id, name: c.id, budget: c.budget ?? 60, taste: [], goal: '', hunger: 3, request: c.request });
const report = { testedAt: new Date().toISOString(), location, configured: { mcp: Boolean(process.env.MCD_MCP_TOKEN), ai: Boolean(process.env.OPENROUTER_API_KEY) }, cases };
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, resolve: { alias: { '@': process.cwd() } }, appType: 'custom', logLevel: 'error' });
try {
  const { fetchMeals } = await vite.ssrLoadModule('/lib/mcd/adapter.ts');
  const { recommend, mealCategory } = await vite.ssrLoadModule('/lib/court/recommend.ts');
  const compact = r => ({ participantId: r.participantId, items: (r.items ?? []).map(m => ({ id: m.id, name: m.name, price: m.price, category: mealCategory(m) })), totalPrice: r.totalPrice, score: r.score, reason: r.reason, constraints: r.constraints, alternatives: (r.alternatives ?? []).map(a => ({ items: a.items.map(m => m.name), totalPrice: a.totalPrice, score: a.score })) });
  async function http(base, batch) {
    const started = Date.now();
    try {
      const response = await fetch(base + '/api/recommend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ partyName: '点名诉求准确性诊断', mode: 'live', location, participants: batch.map(participant) }), signal: AbortSignal.timeout(90000) });
      const body = await response.json();
      const { orderPermit, ...verdict } = body.verdict ?? {};
      const result = { base, caseIds: batch.map(c => c.id), status: response.status, durationMs: Date.now() - started, mealCount: body.mealCount, judge: body.judge, verdict: { ...verdict, recommendations: (verdict.recommendations ?? []).map(compact) }, error: body.error };
      console.log(JSON.stringify({ stage: 'api', base, status: response.status, live: verdict.live, store: verdict.store, judge: body.judge, results: result.verdict.recommendations.map(r => ({ id: r.participantId, items: r.items.map(m => m.name), total: r.totalPrice, reason: r.reason })) }));
      return result;
    } catch (e) { return { base, error: e.message }; }
  }
  const apiPromise = Promise.all([
    http('http://127.0.0.1:3012', cases.slice(0, 4)),
    http('https://mccourt.vercel.app', cases.slice(0, 4)),
    http('https://mccourt.vercel.app', cases.slice(4, 8)),
  ]);
  const catalog = await fetchMeals(location);
  report.catalog = catalog;
  console.log(JSON.stringify({ stage: 'catalog', live: catalog.live, store: catalog.store, count: catalog.meals.length, warning: catalog.warning, named: catalog.meals.filter(m => /板烧|雪碧|可乐|麦香鱼|薯条/.test(m.name)).map(m => ({ name: m.name, price: m.price, category: mealCategory(m) })) }));
  report.ruleResults = cases.map(c => ({ case: c, ...compact(recommend([participant(c)], catalog.meals)[0]) }));
  for (const r of report.ruleResults) console.log(JSON.stringify({ stage: 'rules', request: r.case.request, items: r.items.map(m => m.name), total: r.totalPrice, constraints: r.constraints }));
  report.apiResults = await apiPromise;
} finally { await vite.close(); }
await writeFile('outputs/request-diagnostics.json', JSON.stringify(report, null, 2) + '\n');
