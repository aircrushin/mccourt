import { describe, expect, it } from 'vitest';
import { combinationKey, foodUnits, mealCategory, recommend } from '../../lib/court/recommend';
import type { Meal, Participant } from '../../lib/types/index';

const participant = (patch: Partial<Participant> = {}): Participant => ({ id: 'p1', name: '小王', budget: 40, taste: [], goal: '', hunger: 3, request: '', ...patch });
const meals: Meal[] = [
  { id: 'burger', name: '鸡腿堡', price: 18, calories: 420, protein: 20, tags: ['鸡肉'], source: '测试资料' },
  { id: 'beef', name: '牛肉汉堡', price: 20, calories: 450, protein: 22, tags: ['肉'], source: '测试资料' },
  { id: 'fries', name: '薯条', price: 10, calories: 280, protein: 4, tags: ['小食'], source: '测试资料' },
  { id: 'salad', name: '沙拉', price: 8, calories: 100, protein: 2, tags: ['小食'], source: '测试资料' },
  { id: 'tea', name: '无糖茶', price: 5, calories: 0, protein: 0, tags: ['饮品'], source: '测试资料' },
];

describe('active combination engine', () => {
  it('builds a main, side and drink with an exact budget and two distinct alternatives', () => {
    const [result] = recommend([participant({ budget: 33, request: '必须吃薯条' })], meals);
    expect(result.items.map(mealCategory)).toEqual(['main', 'side', 'drink']);
    expect(result.items.map(m => m.id)).toEqual(['burger', 'fries', 'tea']);
    expect(result.totalPrice).toBe(33);
    expect(result.calories).toBe(700);
    expect(result.protein).toBe(24);
    expect(result.alternatives).toHaveLength(2);
    expect(result.alternatives[0].totalPrice).toBeLessThan(result.totalPrice!);
    const choices = [result, ...result.alternatives];
    expect(new Set(choices.map(c => combinationKey(c.items))).size).toBe(3);
    for (const choice of choices) {
      expect(choice.totalPrice).toBeLessThanOrEqual(33);
      expect(choice.items.every(m => meals.some(source => source === m))).toBe(true);
      expect(new Set(choice.items.map(m => m.id)).size).toBe(choice.items.length);
    }
  });
  it('increases food for a hungrier person instead of adding an equal constant to all scores', () => {
    const [light] = recommend([participant({ budget: 70, hunger: 1 })], meals);
    const [hungry] = recommend([participant({ budget: 70, hunger: 5 })], meals);
    expect(foodUnits(hungry.items)).toBeGreaterThan(foodUnits(light.items));
    expect(hungry.items.filter(m => mealCategory(m) === 'main')).toHaveLength(2);
    expect(hungry.items).toHaveLength(4);
  });
  it('never uses an unknown, invalid or over-budget price to claim budget compliance', () => {
    const invalid = [null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, 100].map((price, i) => ({ ...meals[0], id: String(i), price }));
    const [result] = recommend([participant({ budget: 10 })], invalid);
    expect(result.items).toEqual([]); expect(result.totalPrice).toBeNull();
  });
  it('keeps decimal money within the budget without float drift', () => {
    const [result] = recommend([participant({ budget: 0.3 })], [{ ...meals[0], price: 0.1 }, { ...meals[2], price: 0.2 }]);
    expect(result.totalPrice).toBe(0.3);
    expect(result.items).toHaveLength(2);
  });
  it('does not sum incomplete nutrition or pass it off as a known total', () => {
    const [result] = recommend([participant({ request: '必须吃薯条', budget: 33 })], meals.map(m => m.id === 'fries' ? { ...m, calories: null, protein: null } : m));
    expect(result.items).toHaveLength(3);
    expect(result.calories).toBeNull(); expect(result.protein).toBeNull();
    expect(result.constraints.join(' ')).toContain('营养暂未获取');
  });
  it('honors the fries tag even without free text and explains a budget-limited partial meal', () => {
    const [result] = recommend([participant({ taste: ['今天必须吃薯条'], request: '', budget: 10, hunger: 5 })], meals);
    expect(result.items.map(m => m.id)).toEqual(['fries']);
    expect(result.constraints.join(' ')).toContain('可能不够饱');
  });
  it('does not serve sauce, merchandise or unspecified custom choices as lunch', () => {
    const bad: Meal[] = ['韩式烟熏芝士风味酱', '薯条脆卜卜毛绒周边', '牛肉堡单品精选', '堡堡随心拼（7件任选）'].map((name, i) => ({ ...meals[0], id: String(i), name, price: 3 }));
    const [result] = recommend([participant({ budget: 10 })], bad);
    expect(result.items).toEqual([]);
    expect(mealCategory({ ...meals[0], name: '蘸酱脆皮鸡柳' })).toBe('side');
  });
  it('keeps official sets intact and explicitly marks unknown contents', () => {
    const [result] = recommend([participant()], [{ ...meals[0], name: '鸡腿堡三件套', price: 30 }]);
    expect(result.items).toHaveLength(1);
    expect(result.totalPrice).toBe(30);
    expect(result.constraints.join(' ')).toContain('具体组成与份量暂未获取');
  });
  it('never pools four participants budgets', () => {
    const results = recommend([1, 2, 3, 4].map(i => participant({ id: String(i), budget: 10 * i })), meals);
    expect(results).toHaveLength(4);
    results.forEach((r, i) => expect(r.totalPrice).toBeLessThanOrEqual(10 * (i + 1)));
  });
  it('recomputes strictly cheaper or more substantial appeals and excludes the previous combination', () => {
    const [first] = recommend([participant()], meals);
    const [cheaper] = recommend([participant({ request: '太贵了' })], meals, { excludeCombination: [combinationKey(first.items)], maxTotalExclusive: first.totalPrice! });
    expect(cheaper.totalPrice).toBeLessThan(first.totalPrice!);
    const [bigger] = recommend([participant({ budget: 70, hunger: 5 })], meals, { minFoodUnitsExclusive: foodUnits(first.items), excludeCombination: [combinationKey(first.items)] });
    expect(foodUnits(bigger.items)).toBeGreaterThan(foodUnits(first.items));
    const [impossible] = recommend([participant()], meals, { maxTotalExclusive: 1 });
    expect(impossible.items).toEqual([]);
  });
});
