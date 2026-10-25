import type { Meal, Participant } from '@/lib/types/index';
import { mealCategory, textOf } from './meals';

type Target = { label: string; terms: string[]; matches: (meal: Meal) => boolean; rejects?: (meal: Meal) => boolean };
type Exclusion = Target & { other: boolean };
export type MealPreferences = { required: Target[][]; excluded: Exclusion[]; only: boolean };

// Match names from this menu, plus common short names even when absent from it.
const normalize = (value: string) => value.normalize('NFKC').replace(/\([^)]*\)|[\s“”"'【】]/g, '').toLowerCase();
function named(label: string, terms = [label]): Target {
  return {
    label, terms,
    matches: meal => mealCategory(meal) !== 'set' && normalize(meal.name) === normalize(label),
    rejects: meal => normalize(meal.name).includes(normalize(label)),
  };
}

function targetsFor(meals: Meal[]): Target[] {
  const names = meals.filter(meal => mealCategory(meal) !== 'excluded').map(meal => {
    const name = normalize(meal.name);
    return { label: meal.name.replace(/[（(]体验案例[）)]/g, ''), terms: [name], matches: (candidate: Meal) => normalize(candidate.name) === name };
  });
  return [
    named('板烧鸡腿堡', ['板烧鸡腿堡', '板烧']),
    ...['巨无霸', '麦香鸡', '麦香鱼', '麦辣鸡腿堡', '雪碧', '可乐', '薯条', '麦乐鸡', '脆薯饼', '纯悦'].map(name => named(name)),
    { label: '汉堡', terms: ['汉堡'], matches: meal => mealCategory(meal) === 'main' && /堡|麦香鸡|麦香鱼/.test(meal.name) },
    { label: '饮品', terms: ['饮品', '饮料'], matches: meal => mealCategory(meal) === 'drink' },
    { label: '主食', terms: ['主食'], matches: meal => mealCategory(meal) === 'main' },
    { label: '小食', terms: ['小食'], matches: meal => mealCategory(meal) === 'side' },
    { label: '套餐', terms: ['套餐'], matches: meal => mealCategory(meal) === 'set' },
    ...['鸡肉', '牛肉', '鱼肉'].map(label => ({ label, terms: [label], matches: (meal: Meal) => textOf(meal).includes(label) })),
    { label: '辣味', terms: ['辣'], matches: meal => /辣/.test(textOf(meal)) },
    ...names,
  ];
}

export function parseMealPreferences(participant: Participant, meals: Meal[]): MealPreferences {
  const result: MealPreferences = { required: [], excluded: [], only: false };
  const targets = targetsFor(meals);
  // Longest names win: “板烧鸡腿堡” must not also become a generic “鸡腿堡” request.
  const lexicon = targets.flatMap(target => target.terms.map(term => ({ term: normalize(term), target })))
    .sort((a, b) => b.term.length - a.term.length);
  const required = new Map<string, Target>();
  const excluded = new Map<string, Exclusion>();
  for (const source of [...participant.taste, participant.goal, participant.request]) {
    for (const clause of source.split(/[，,。；;！!？?\n]|但是|不过|但|上诉[:：]?/).map(normalize)) {
      if (/^(?:我)?(?:只要|只吃|只喝|仅要)/.test(clause)) {
        required.clear();
        result.required = [];
        result.only = true;
      }
      let negative = false;
      let previousEnd = 0;
      let previousRequired: Target[] | undefined;
      const clauseGroups: Target[][] = [];
      for (let index = 0; index < clause.length;) {
        const match = lexicon.find(entry => clause.startsWith(entry.term, index));
        if (!match) { index++; continue; }
        const prefix = clause.slice(previousEnd, index);
        // Carry negation across “和/、”, but reset it on an explicit new request.
        const actions = prefix.match(/不要|不想(?:吃|喝|要)?|不喜欢|不吃|不喝|不点|不加|不配|不能(?:吃|喝)|去掉|拒绝|别(?:给|加|放|配|要)?|不(?=太?$)|只要|只吃|只喝|仅要|想吃|想喝|必须吃|必须喝|要|来|换|加|配/g);
        if (actions?.length) negative = /^(?:不|别|去掉|拒绝)/.test(actions.at(-1)!);
        if (/^(?:不要|不吃|不喝)/.test(clause.slice(index + match.term.length))) negative = true;
        const target = match.target;
        if (negative) {
          required.delete(target.label);
          excluded.set(target.label, { ...target, matches: target.rejects ?? target.matches, other: /其他|别的/.test(prefix) });
          previousRequired = undefined;
        } else {
          excluded.delete(target.label);
          // Ingredient and spicy mentions remain soft preferences unless explicitly required.
          if (!['鸡肉', '牛肉', '鱼肉', '辣味'].includes(target.label) || /必须|只(?:要|吃|喝)|仅要/.test(prefix)) {
            if (/换成|换为|改成|改为|改吃|改喝/.test(prefix)) {
              const categories = new Set(meals.filter(target.matches).map(mealCategory));
              for (const earlier of required.values()) {
                if (earlier.label !== target.label && meals.some(meal => earlier.matches(meal) && categories.has(mealCategory(meal)))) {
                  required.delete(earlier.label);
                  excluded.set(earlier.label, { ...earlier, matches: earlier.rejects ?? earlier.matches, other: true });
                }
              }
            }
            required.set(target.label, target);
            if (previousRequired && /或|还是|\//.test(prefix)) previousRequired.push(target);
            else { previousRequired = [target]; clauseGroups.push(previousRequired); }
            if (/只(?:要|吃|喝)|仅要/.test(prefix)) result.only = true;
          }
        }
        previousEnd = index + match.term.length;
        index = previousEnd;
      }
      // Preserve explicit but unknown objects as unmet requests, rather than guessing a substitute.
      const explicit = clause.match(/^(?:我)?(?:只要|只吃|只喝|仅要|想吃|想喝|要吃|要喝|要|来一[个杯份])(.+)$/)?.[1];
      if (explicit) for (const object of explicit.split(/和|与|、|以及|还有|\+/)) {
        const label = object.replace(/^(?:吃|喝|点)?(?:[一二两三四五六七八九十\d]+[个杯份块])?/, '').replace(/(?:吧|谢谢)$/, '');
        if (!label || label.length > 24 || lexicon.some(entry => label.includes(entry.term))) continue;
        if (/^(?:饱|肉|鸡肉|牛肉|鱼肉|东西|食物|随便|便宜一点|省钱|高蛋白|蛋白质|低热量)$/.test(label)) continue;
        const target = named(label);
        required.set(label, target);
        clauseGroups.push([target]);
      }
      if (/都行|都可以|任选一个|二选一/.test(clause) && clauseGroups.length > 1) {
        result.required.push(clauseGroups.flat());
      } else result.required.push(...clauseGroups);
    }
  }
  // Later statements (including appeals) override earlier statements for the same target.
  result.required = result.required.map(group => group.filter(target => required.has(target.label)))
    .filter(group => group.length > 0)
    .filter((group, index, groups) => groups.findIndex(other => other.map(t => t.label).sort().join('|') === group.map(t => t.label).sort().join('|')) === index);
  result.excluded = [...excluded.values()];
  return result;
}

export function matchesRequired(items: Meal[], preferences: MealPreferences) {
  return preferences.required.every(group => items.some(meal => group.some(target => target.matches(meal))));
}

export function allowedByPreferences(meal: Meal, preferences: MealPreferences) {
  const explicitlyWanted = preferences.required.some(group => group.some(target => target.matches(meal)));
  if (preferences.only && !explicitlyWanted) return false;
  // Unknown bundle contents cannot prove that an excluded food/drink is absent.
  if (preferences.excluded.length && mealCategory(meal) === 'set') return false;
  return !preferences.excluded.some(target => target.matches(meal) && !(target.other && explicitlyWanted));
}

export const requiredLabels = (preferences: MealPreferences) => preferences.required.map(group => group.map(target => target.label).join('或'));
