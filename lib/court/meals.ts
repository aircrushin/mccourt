import type { Meal } from '@/lib/types/index';

export type MealCategory = 'main' | 'side' | 'drink' | 'set' | 'excluded';
export const textOf = (meal: Meal) => `${meal.name} ${meal.tags.join(' ')}`;

// Categories and food units are conservative heuristics, never measured satiety.
export function mealCategory(meal: Meal): MealCategory {
  const name = meal.name;
  const text = textOf(meal);
  if (/周边|毛绒|玩具|按摩|痒痒挠|任选|随心拼|精选|多人|双人|拼盘|乐园餐/.test(text)) return 'excluded';
  if (/风味酱$|蘸酱$|调味|餐具/.test(name)) return 'excluded';
  if (/套餐|[一二三四五六七八九十两\d]+件套|单人餐/.test(text)) return 'set';
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
