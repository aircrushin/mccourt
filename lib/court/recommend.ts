import type { Participant, Meal, MealCombination, Recommendation } from '@/lib/types/index';
import { foodUnits, mealCategory, textOf } from './meals';
import { allowedByPreferences, matchesRequired, parseMealPreferences, requiredLabels } from './preferences';

export { foodUnits, mealCategory, type MealCategory } from './meals';
const cents = (value: number) => Math.round(value * 100);
export const combinationKey = (items: Meal[]) => items.map(m => m.id).sort().join('|');

function sumKnown(items: Meal[], field: 'calories' | 'protein'): number | null {
  return items.length && items.every(item => item[field] != null && Number.isFinite(item[field]) && item[field]! >= 0)
    ? Math.round(items.reduce((sum, item) => sum + item[field]!, 0) * 10) / 10 : null;
}
export type RecommendOptions = { excludeCombination?: string[]; maxTotalExclusive?: number; minFoodUnitsExclusive?: number };

export function recommend(participants: Participant[], meals: Meal[], options: RecommendOptions = {}): Recommendation[] {
  return participants.map(p => {
    const context = `${p.taste.join(' ')} ${p.goal} ${p.request}`;
    const preferences = parseMealPreferences(p, meals);
    const requested = requiredLabels(preferences);
    const budget = cents(p.budget);
    const seen = new Set<string>();
    const candidates = meals.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return m.price != null && Number.isFinite(m.price) && m.price >= 0 && cents(m.price) <= budget
        && mealCategory(m) !== 'excluded' && allowedByPreferences(m, preferences);
    });
    const mains = candidates.filter(m => mealCategory(m) === 'main');
    const sides = candidates.filter(m => mealCategory(m) === 'side');
    const drinks = candidates.filter(m => mealCategory(m) === 'drink');
    const sets = candidates.filter(m => mealCategory(m) === 'set');
    // Seed combinations with every explicit request before adding optional food.
    let seeds: Meal[][] = [[]];
    for (const group of preferences.required) {
      const next = new Map<string, Meal[]>();
      for (const seed of seeds) for (const meal of candidates.filter(m => group.some(target => target.matches(m)))) {
        const items = seed.some(m => m.id === meal.id) ? seed : [...seed, meal];
        if (items.length <= 6 && items.reduce((sum, m) => sum + cents(m.price!), 0) <= budget) next.set(combinationKey(items), items);
      }
      seeds = [...next.values()];
    }
    const requestMatch = { required: requested, excluded: preferences.excluded.map(target => `${target.other ? '其他' : ''}${target.label}`), only: preferences.only, satisfied: true, issues: [] as string[] };
    const target = [0.55, 1, 1.65, 2.1, 2.55][p.hunger - 1];
    const ranked: MealCombination[] = [];
    const considered = new Set<string>();
    const consider = (items: Meal[]) => {
      if (!items.length || items.length > 6 || !matchesRequired(items, preferences)) return;
      const order = ['main', 'side', 'drink', 'set', 'excluded'];
      items = [...items].sort((a, b) => order.indexOf(mealCategory(a)) - order.indexOf(mealCategory(b)));
      const key = combinationKey(items);
      if (considered.has(key)) return;
      considered.add(key);
      const totalCents = items.reduce((sum, m) => sum + cents(m.price!), 0);
      if (totalCents > budget || (options.maxTotalExclusive != null && totalCents >= cents(options.maxTotalExclusive))) return;
      if (options.excludeCombination?.includes(combinationKey(items))) return;
      const units = foodUnits(items);
      if (options.minFoodUnitsExclusive != null && units <= options.minFoodUnitsExclusive + 0.001) return;
      const totalPrice = totalCents / 100;
      const calories = sumKnown(items, 'calories');
      const protein = sumKnown(items, 'protein');
      const main = items.some(m => ['main', 'set'].includes(mealCategory(m)));
      const side = items.some(m => mealCategory(m) === 'side');
      const drink = items.some(m => mealCategory(m) === 'drink');
      const text = items.map(textOf).join(' ');
      let score = 40 - Math.abs(units - target) * 35;
      if (main) score += p.hunger >= 3 ? 24 : 8;
      if (main && side) score += 8;
      if (drink && (main || side)) score += p.hunger >= 3 ? 9 : 3;
      if (!units) score -= 60;
      if (/吃肉/.test(context) && /肉|鸡|牛|鱼/.test(text)) score += 22;
      if (/鸡肉|吃鸡/.test(context) && /鸡/.test(text)) score += 22;
      if (/想.*辣|喜欢辣/.test(context) && /辣/.test(text)) score += 15;
      if (/蛋白|健身/.test(context) && protein != null) score += Math.min(protein / 30, 1.5) * 25;
      if (/热量|减脂|控制/.test(context) && calories != null) score += Math.max(-25, 25 - calories / 25);
      const savingWeight = /省钱|便宜|太贵/.test(context) ? 35 : 10;
      score += savingWeight * (1 - totalCents / Math.max(1, budget));
      const constraints: string[] = [];
      if (!main && p.hunger >= 3 && !preferences.only) constraints.push('当前偏好与预算下未搭配主食，可能不够饱。');
      if (!drink && !items.some(m => mealCategory(m) === 'set')) constraints.push('本组合未搭配饮品；如需饮品，可调整诉求或预算。');
      if (units < target - 0.3 && !preferences.only) constraints.push('当前预算与诉求下的搭配份量可能无法满足当前饥饿程度。');
      if (calories == null || protein == null) constraints.push('部分餐品营养暂未获取，不展示不完整的营养总量。');
      if (items.some(m => mealCategory(m) === 'set')) constraints.push('官方套餐按整份价格推荐，具体组成与份量暂未获取，未拆分或补造套餐内容。');
      constraints.push('搭配份量按餐品类别粗略估计，实际饱腹感因人而异。');
      ranked.push({ items, totalPrice, calories, protein, score: Math.round(score * 10) / 10,
        reason: `${requested.length ? `已满足${preferences.only ? '仅选' : '指定'}餐品「${requested.join('、')}」；` : ''}按${p.hunger >= 4 ? '较高' : p.hunger <= 2 ? '较轻' : '适中'}饥饿程度搭配${items.length}项餐品，合计 ${totalPrice.toFixed(2)} 元，未超过 ${p.budget} 元预算。`, constraints, requestMatch });
    };
    const additions = (pool: Meal[], count: number): Meal[][] => {
      const choices: Meal[][] = [[]];
      if (count >= 1) choices.push(...pool.map(meal => [meal]));
      if (count >= 2) for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) choices.push([pool[i], pool[j]]);
      return choices;
    };
    for (const seed of seeds) {
      if (seed.some(m => mealCategory(m) === 'set')) { consider(seed); continue; }
      const mainCount = seed.filter(m => mealCategory(m) === 'main').length;
      const extraMains = additions(mains.filter(m => !seed.includes(m)), Math.max(0, (p.hunger >= 4 ? 2 : 1) - mainCount));
      const extraSides = additions(sides, seed.some(m => mealCategory(m) === 'side') ? 0 : 1);
      const extraDrinks = additions(drinks, seed.some(m => mealCategory(m) === 'drink') ? 0 : 1);
      for (const main of extraMains) for (const side of extraSides) for (const drink of extraDrinks) consider([...seed, ...main, ...side, ...drink]);
    }
    sets.forEach(set => consider([set]));
    ranked.sort((a, b) => b.score - a.score || a.totalPrice! - b.totalPrice! || combinationKey(a.items).localeCompare(combinationKey(b.items)));
    // Identical names can have different MCP IDs. Do not present them as alternatives.
    const signatures = new Set<string>();
    const distinct = ranked.filter(combo => {
      const signature = combo.items.map(m => m.name).sort().join('|');
      if (signatures.has(signature)) return false;
      signatures.add(signature); return true;
    });
    const best = distinct[0];
    if (!best) {
      const issues = preferences.required.flatMap(group => {
        const label = group.map(target => target.label).join('或');
        const matching = meals.filter(m => mealCategory(m) !== 'excluded' && group.some(target => target.matches(m)));
        if (!matching.length) return [`当前门店菜单中未找到可验证的「${label}」，未自动替换；这不代表已确认售罄。`];
        const priced = matching.filter(m => m.price != null && Number.isFinite(m.price) && m.price >= 0);
        if (!priced.length) return [`「${label}」价格暂未获取，无法核实预算。`];
        const lowest = Math.min(...priced.map(m => m.price!));
        if (cents(lowest) > budget) return [`「${label}」最低已知价格 ${lowest.toFixed(2)} 元，超过 ${p.budget} 元预算。`];
        if (!matching.some(m => allowedByPreferences(m, preferences))) return [`「${label}」与排除要求冲突，请调整诉求。`];
        return [];
      });
      if (!issues.length) issues.push(requested.length
        ? `当前 ${p.budget} 元预算与${options.excludeCombination ? '上诉' : '搭配'}条件下，无法同时满足「${requested.join('、')}」，未用其他餐品替换。`
        : '当前预算与诉求下，没有价格可验证且符合条件的餐品组合。');
      return { participantId: p.id, items: [], totalPrice: null, calories: null, protein: null, score: 0,
        reason: issues.join(' '), constraints: issues, requestMatch: { ...requestMatch, satisfied: false, issues }, alternatives: [] };
    }
    const remaining = distinct.slice(1);
    const alternatives: MealCombination[] = [];
    const cheaper = remaining.find(combo => combo.totalPrice! < best.totalPrice!);
    if (cheaper) alternatives.push(cheaper);
    const mainKey = (combo: MealCombination) => combo.items.filter(m => ['main', 'set'].includes(mealCategory(m))).map(m => m.name).sort().join('|');
    const differentMain = remaining.find(combo => combo !== cheaper && mainKey(combo) !== mainKey(best));
    const other = differentMain ?? remaining.find(combo => combo !== cheaper);
    if (other) alternatives.push(other);
    if (alternatives.length < 2) {
      const next = remaining.find(combo => !alternatives.includes(combo));
      if (next) alternatives.push(next);
    }
    return { participantId: p.id, ...best, alternatives };
  });
}
