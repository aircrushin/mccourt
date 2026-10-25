import { describe, expect, it } from 'vitest';
import { mealCategory, recommend } from '../../lib/court/recommend';
import type { Meal, Participant } from '../../lib/types/index';

const meals: Meal[] = [
  { id: 'cheap', name: '龙焰鸡腿堡', price: 15.9, tags: ['韩式辣椒黄油风味'], source: '测试资料' },
  { id: 'grilled', name: '板烧鸡腿堡', price: 23.5, tags: [], source: '测试资料' },
  { id: 'fish', name: '麦香鱼', price: 22.5, tags: [], source: '测试资料' },
  { id: 'fries', name: '薯条', price: 13.5, tags: [], source: '测试资料' },
  { id: 'crispy-fries', name: '脆脆薯条', price: 16, tags: [], source: '测试资料' },
  { id: 'hash', name: '脆薯饼', price: 8.5, tags: [], source: '测试资料' },
  { id: 'sprite', name: '雪碧', price: 9.5, tags: [], source: '测试资料' },
  { id: 'coke', name: '可乐', price: 9.5, tags: [], source: '测试资料' },
  { id: 'water', name: '纯悦', price: 7.5, tags: ['饮品'], source: '测试资料' },
  { id: 'set', name: '板烧鸡腿堡四件套', price: 28, tags: [], source: '测试资料' },
];
const participant = (request: string, patch: Partial<Participant> = {}): Participant => ({ id: 'p1', name: '小王', budget: 60, hunger: 3, taste: [], goal: '', request, ...patch });
const choices = (request: string, patch: Partial<Participant> = {}, catalog = meals) => {
  const [result] = recommend([participant(request, patch)], catalog);
  return [result, ...result.alternatives];
};

describe('explicit meal requests', () => {
  it.each([
    ['我要汉堡和雪碧', ['sprite']],
    ['我要吃板烧', ['grilled']],
    ['我要吃板烧鸡腿堡和雪碧', ['grilled', 'sprite']],
    ['我要吃麦香鱼', ['fish']],
    ['我要汉堡和可乐', ['coke']],
    ['我要汉堡、薯条和雪碧', ['fries', 'sprite']],
  ])('keeps requested items in the recommendation AND alternatives: %s', (request, ids) => {
    for (const choice of choices(request)) {
      expect(choice.items.length).toBeGreaterThan(0);
      expect(choice.items.map(m => m.id)).toEqual(expect.arrayContaining(ids));
      expect(choice.totalPrice).toBeLessThanOrEqual(60);
      expect(choice.requestMatch?.satisfied).toBe(true);
    }
  });

  it('resolves new menu names without adding another hardcoded keyword', () => {
    const special = { ...meals[0], id: 'special', name: '烟熏芝士牛肉堡', price: 25 };
    expect(choices('我要烟熏芝士牛肉堡', {}, [...meals, special])[0].items).toContain(special);
  });

  it('allows multiple explicitly requested mains and drinks even at moderate hunger', () => {
    const result = choices('只要板烧和麦香鱼、雪碧', { budget: 60 })[0];
    expect(result.items.map(m => m.id).sort()).toEqual(['fish', 'grilled', 'sprite']);
    expect(result.totalPrice).toBe(55.5);
    const drinks = choices('只要可乐和雪碧')[0];
    expect(drinks.items.map(m => m.id).sort()).toEqual(['coke', 'sprite']);
  });

  it('accepts either requested alternative without requiring both', () => {
    for (const choice of choices('只要板烧或麦香鱼', { budget: 24 })) {
      expect(choice.items).toHaveLength(1);
      expect(['grilled', 'fish']).toContain(choice.items[0].id);
    }
  });

  it('does not add food when only one drink was requested', () => {
    const result = choices('只要一杯雪碧，不要其他食物')[0];
    expect(result.items.map(m => m.id)).toEqual(['sprite']);
    expect(result.totalPrice).toBe(9.5);
    expect(result.constraints.join(' ')).not.toContain('预算或可用餐品限制');
  });
  it('lets an only-one-item appeal replace earlier requests', () => {
    expect(choices('我要板烧和雪碧；上诉：只要雪碧')[0].items.map(m => m.id)).toEqual(['sprite']);
  });

  it('reports missing named items instead of substituting a cheaper burger', () => {
    const [result] = recommend([participant('我要吃板烧和雪碧')], meals.filter(m => m.id !== 'grilled'));
    expect(result.items).toEqual([]);
    expect(result.reason).toContain('菜单中未找到');
    expect(result.reason).toContain('板烧鸡腿堡');
    expect(result.requestMatch?.satisfied).toBe(false);
    expect(result.alternatives).toEqual([]);
  });

  it.each(['我要草莓奶昔', '只要一杯草莓奶昔', '我要板烧和草莓奶昔'])('explains an unknown explicit request: %s', request => {
    const result = choices(request)[0];
    expect(result.items).toEqual([]);
    expect(result.reason).toContain('草莓奶昔');
    expect(result.reason).toContain('菜单中未找到');
  });

  it('explains individual and combined budget shortfalls and unknown prices', () => {
    const individual = choices('我要板烧和雪碧', { budget: 10 })[0];
    expect(individual.items).toEqual([]);
    expect(individual.reason).toContain('23.50');
    const combined = choices('我要板烧和雪碧', { budget: 30 })[0];
    expect(combined.items).toEqual([]);
    expect(combined.reason).toContain('无法同时满足');
    expect(combined.reason).toContain('雪碧');
    const unknown = choices('我要雪碧', {}, meals.map(m => m.id === 'sprite' ? { ...m, price: null } : m))[0];
    expect(unknown.items).toEqual([]);
    expect(unknown.reason).toContain('价格暂未获取');
  });

  it('does not claim an opaque bundle contains the requested single items', () => {
    expect(mealCategory(meals.at(-1)!)).toBe('set');
    expect(choices('我要板烧和雪碧', {}, meals.filter(m => m.id !== 'grilled'))[0].items).toEqual([]);
  });
});

describe('negation and corrections', () => {
  it.each(['不要薯条，要板烧和雪碧', '不要薯条要板烧和雪碧', '不吃薯条和麦香鱼，要板烧和雪碧', '不要薯条\n板烧和雪碧'])('honors exclusions and resets negation for %s', request => {
    for (const choice of choices(request)) {
      expect(choice.items.map(m => m.id)).toEqual(expect.arrayContaining(['grilled', 'sprite']));
      expect(choice.items.some(m => /薯条|麦香鱼/.test(m.name))).toBe(false);
    }
  });

  it('excludes a named drink without banning all drinks', () => {
    for (const choice of choices('不喝可乐，要板烧和雪碧')) {
      expect(choice.items.map(m => m.id)).toEqual(expect.arrayContaining(['grilled', 'sprite']));
      expect(choice.items.some(m => m.id === 'coke')).toBe(false);
    }
  });

  it('excludes every drink when the category is rejected', () => {
    for (const choice of choices('不喝饮料，要板烧')) {
      expect(choice.items.some(m => m.id === 'grilled')).toBe(true);
      expect(choice.items.some(m => mealCategory(m) === 'drink' || mealCategory(m) === 'set')).toBe(false);
    }
  });

  it('carries exclusions over conjunctions and applies later corrections', () => {
    const result = choices('不要可乐和雪碧，要板烧')[0];
    expect(result.items.some(m => ['coke', 'sprite'].includes(m.id))).toBe(false);
    const corrected = choices('不要雪碧，改成要雪碧和板烧')[0];
    expect(corrected.items.map(m => m.id)).toEqual(expect.arrayContaining(['grilled', 'sprite']));
    const overridden = choices('不要薯条，要板烧', { taste: ['今天必须吃薯条'] })[0];
    expect(overridden.items.some(m => /薯条/.test(m.name))).toBe(false);
  });

  it('keeps the explicitly requested burger when other burgers are rejected on appeal', () => {
    for (const choice of choices('我要板烧和雪碧；上诉：我明确要板烧鸡腿堡和雪碧，不要其他汉堡和纯悦')) {
      expect(choice.items.map(m => m.id)).toEqual(expect.arrayContaining(['grilled', 'sprite']));
      expect(choice.items.some(m => ['cheap', 'fish', 'water'].includes(m.id))).toBe(false);
    }
  });
  it('replaces the original item after an explicit change-of-mind appeal', () => {
    for (const choice of choices('我要板烧和雪碧；上诉：板烧换成麦香鱼')) {
      expect(choice.items.map(m => m.id)).toEqual(expect.arrayContaining(['fish', 'sprite']));
      expect(choice.items.some(m => m.id === 'grilled')).toBe(false);
    }
  });
  it('can replace a generic category request with a specific item', () => {
    const result = choices('我要汉堡和雪碧；上诉：汉堡换成麦香鱼')[0];
    expect(result.items.map(m => m.id)).toEqual(expect.arrayContaining(['fish', 'sprite']));
    expect(result.items.some(m => ['grilled', 'cheap'].includes(m.id))).toBe(false);
  });
});
