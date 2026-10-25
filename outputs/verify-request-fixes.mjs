import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const previous = JSON.parse(await readFile('outputs/request-diagnostics.json', 'utf8'));
const base = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3012';
const participant = c => ({ id:c.id, name:c.id, budget:c.budget ?? 60, taste:[], goal:'', hunger:3, request:c.request });
const report = { testedAt:new Date().toISOString(), base, location:previous.location };
const vite = await createServer({ configFile:false, server:{middlewareMode:true}, resolve:{alias:{'@':process.cwd()}}, appType:'custom', logLevel:'error' });
try {
  const { fetchMeals } = await vite.ssrLoadModule('/lib/mcd/adapter.ts');
  const { recommend, mealCategory } = await vite.ssrLoadModule('/lib/court/recommend.ts');
  const catalog = await fetchMeals(previous.location);
  assert(catalog.live && catalog.meals.length > 0, 'Live menu unavailable');
  report.catalog = catalog;
  function verify(c, r) {
    if (c.id === 'impossible-budget') {
      assert.equal(r.items.length, 0); assert.equal(r.requestMatch.satisfied, false);
      assert.match(r.reason, /预算/); assert.match(r.reason, /板烧/); return;
    }
    for (const combo of [r, ...r.alternatives]) {
      assert(combo.items.length > 0, `${c.id}: empty`);
      for (const term of c.expected) assert(combo.items.some(m => term === '主食' ? mealCategory(m) === 'main' : m.name.includes(term)), `${c.id}: missing ${term}`);
      for (const term of c.forbidden ?? []) assert(!combo.items.some(m => term === '饮品' ? mealCategory(m) === 'drink' : m.name.includes(term)), `${c.id}: forbidden ${term}`);
      if (c.only) assert.equal(combo.items.length, 1);
      assert(combo.totalPrice <= (c.budget ?? 60));
      assert.equal(combo.requestMatch.satisfied, true);
    }
  }
  report.rules = previous.cases.map(c => {
    const [result] = recommend([participant(c)], catalog.meals);
    verify(c, result);
    return { case:c, result };
  });
  console.log(`PASS ${report.rules.length} cases against ${catalog.meals.length} real menu entries; all alternatives verified`);
  async function post(path, input) {
    const response = await fetch(base + path, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(input), signal:AbortSignal.timeout(90000) });
    assert(response.ok, `${path}: HTTP ${response.status}`);
    const body = await response.json();
    if (body.verdict) delete body.verdict.orderPermit;
    delete body.orderPermit;
    return body;
  }
  const batches = [previous.cases.slice(0,4), previous.cases.slice(4,8), previous.cases.slice(8,12)];
  report.api = [];
  const checks = await Promise.allSettled(batches.map(async cases => {
    const input = { partyName:'修复后实时验证', mode:'live', location:previous.location, participants:cases.map(participant) };
    const body = await post('/api/recommend', input);
    report.api.push({ input, body });
    assert.equal(body.verdict.live, true);
    for (const c of cases) verify(c, body.verdict.recommendations.find(r => r.participantId === c.id));
    console.log(JSON.stringify({ stage:'api', judge:body.judge, cases:cases.map(c => c.id), results:body.verdict.recommendations.map(r => ({id:r.participantId, items:r.items.map(m => m.name), total:r.totalPrice, reason:r.reason})) }));
  }));
  for (const check of checks) if (check.status === 'rejected') throw check.reason;
  const c = previous.cases.find(c => c.id === 'grilled-sprite');
  const input = { participant:participant(c), reason:'我明确要板烧鸡腿堡和雪碧，不要其他汉堡和纯悦，也不要薯条', previousItemIds:previous.apiResults[0].verdict.recommendations[0].items.map(m => m.id), mode:'live', storeCode:catalog.store.storeCode };
  const body = await post('/api/appeal', input);
  verify({...c, forbidden:['纯悦','薯条']}, body.recommendation);
  report.appeal = { input, body };
  console.log(JSON.stringify({stage:'appeal',items:body.recommendation.items.map(m => m.name),total:body.recommendation.totalPrice}));
} finally {
  await vite.close();
  await writeFile('outputs/request-fixes-verification.json', JSON.stringify(report, null, 2) + '\n');
}
