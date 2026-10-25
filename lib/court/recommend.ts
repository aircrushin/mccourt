import type { Participant, Meal, MealCombination, Recommendation } from '@/lib/types/index';

export type MealCategory = 'main' | 'side' | 'drink' | 'set' | 'excluded';
const cents = (value: number) => Math.round(value * 100);
const textOf = (meal: Meal) => `${meal.name} ${meal.tags.join(' ')}`;
export const combinationKey = (items: Meal[]) => items.map(m => m.id).sort().join('|');

// Categories and food units are conservative heuristics, never measured satiety.
export function mealCategory(meal: Meal): MealCategory {
  const name = meal.name;
  const text = textOf(meal);
  if (/周边|毛绒|玩具|按摩|痒痒挠|任选|随心拼|精选|多人|双人|拼盘|乐园餐/.test(text)) return 'excluded';
  if (/风味酱$|蘸酱$|调味|餐具/.test(name)) return 'excluded';
  if (/套餐|三件套|单人餐/.test(text)) return 'set';
  if (/汉堡|堡|巨无霸|麦香鸡|麦香鱼|鸡肉卷|饭|面条/.test(name)) return 'main';
  if (/饮品|冷饮|热饮|咖啡|奶铁|美式|卡布奇诺/.test(text) || /可乐|雪碧|牛奶|燕麦奶|果汁|红茶|柠檬|黄金橙|多汁柠|浓浓黑巧/.test(name)) return 'drink';
  if (/薯|鸡翅|鸡块|鸡排|鸡柳|脆汁鸡|麦乐鸡|炸鸡|玉米|苹果|沙拉|冰淇淋|圆筒|麦旋风|新地|派/.test(name)) return 'side';
  return 'excluded';
}

export function foodUnits(items: Meal[]) {
  return items.reduce((sum, item) => {
    const category = mealCategory(item);
    if (category === 'side') {
      if (/冰淇淋|圆筒|麦旋风|新地|派/.test(item.name)) return sum + 0.2;
      if (/沙拉|苹果|玉米/.test(item.name)) return sum + 0.35;
      if (/鸡/.test(item.name)) return sum + 0.75;
    }
    return sum + ({ main: 1, side: 0.55, drink: 0, set: 1.7, excluded: 0 }[category]);
  }, 0);
}
function sumKnown(items: Meal[], field: 'calories' | 'protein'): number | null {
  return items.length && items.every(item => item[field] != null && Number.isFinite(item[field]) && item[field]! >= 0)
    ? Math.round(items.reduce((sum, item) => sum + item[field]!, 0) * 10) / 10 : null;
}
export type RecommendOptions = { excludeCombination?: string[]; maxTotalExclusive?: number; minFoodUnitsExclusive?: number };

export function recommend(participants: Participant[], meals: Meal[], options: RecommendOptions = {}): Recommendation[] {
  return participants.map(p => {
    const context = `${p.taste.join(' ')} ${p.goal} ${p.request}`;
    const budget = cents(p.budget);
    const seen = new Set<string>();
    const candidates = meals.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return m.price != null && Number.isFinite(m.price) && m.price >= 0 && cents(m.price) <= budget
        && mealCategory(m) !== 'excluded'
        && !(/不吃辣|不要辣|不辣/.test(context) && /辣/.test(textOf(m)))
        && !(/不喝|不要饮[品料]/.test(context) && mealCategory(m) === 'drink');
    });
    const mains = candidates.filter(m => mealCategory(m) === 'main');
    const sides = candidates.filter(m => mealCategory(m) === 'side');
    const drinks = candidates.filter(m => mealCategory(m) === 'drink');
    const sets = candidates.filter(m => mealCategory(m) === 'set');
    const mainChoices: Meal[][] = [[], ...mains.map(m => [m])];
    if (p.hunger >= 4) for (let i = 0; i < mains.length; i++) for (let j = i + 1; j < mains.length; j++) mainChoices.push([mains[i], mains[j]]);
    const target = [0.55, 1, 1.65, 2.1, 2.55][p.hunger - 1];
    const ranked: MealCombination[] = [];
    const consider = (items: Meal[]) => {
      if (!items.length) return;
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
      if (/薯条/.test(context) && items.some(m => /薯条/.test(m.name))) score += 55;
      if (/吃肉/.test(context) && /肉|鸡|牛|鱼/.test(text)) score += 22;
      if (/鸡肉|吃鸡/.test(context) && /鸡/.test(text)) score += 22;
      if (/想.*辣|喜欢辣/.test(context) && /辣/.test(text)) score += 15;
      if (/蛋白|健身/.test(context) && protein != null) score += Math.min(protein / 30, 1.5) * 25;
      if (/热量|减脂|控制/.test(context) && calories != null) score += Math.max(-25, 25 - calories / 25);
      const savingWeight = /省钱|便宜|太贵/.test(context) ? 35 : 10;
      score += savingWeight * (1 - totalCents / Math.max(1, budget));
      const constraints: string[] = [];
      if (!main && p.hunger >= 3) constraints.push('当前偏好与预算下未搭配主食，可能不够饱。');
      if (!drink && !items.some(m => mealCategory(m) === 'set')) constraints.push('本组合未搭配饮品；不为凑齐品类突破预算。');
      if (units < target - 0.3) constraints.push('预算或可用餐品限制了搭配份量，可能无法满足当前饥饿程度。');
      if (/薯条/.test(context) && !items.some(m => /薯条/.test(m.name))) constraints.push('当前可验证餐品与预算内无法兼顾薯条诉求。');
      if (calories == null || protein == null) constraints.push('部分餐品营养暂未获取，不展示不完整的营养总量。');
      if (items.some(m => mealCategory(m) === 'set')) constraints.push('官方套餐按整份价格推荐，具体组成与份量暂未获取，未拆分或补造套餐内容。');
      constraints.push('搭配份量按餐品类别粗略估计，实际饱腹感因人而异。');
      ranked.push({ items, totalPrice, calories, protein, score: Math.round(score * 10) / 10,
        reason: `按${p.hunger >= 4 ? '较高' : p.hunger <= 2 ? '较轻' : '适中'}饥饿程度搭配${items.length}项餐品，合计 ${totalPrice.toFixed(2)} 元，未超过 ${p.budget} 元预算。`, constraints });
    };
    for (const main of mainChoices) for (const side of [null, ...sides]) for (const drink of [null, ...drinks]) {
      consider([...main, ...(side ? [side] : []), ...(drink ? [drink] : [])]);
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
    if (!best) return { participantId: p.id, items: [], totalPrice: null, calories: null, protein: null, score: 0,
      reason: '当前预算与诉求下，没有价格可验证且符合条件的餐品组合。', constraints: ['价格缺失、超预算、无法确认内容或不适合独立食用的条目不进入组合。'], alternatives: [] };
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
