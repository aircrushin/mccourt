import type { Participant, Meal, Recommendation } from '@/lib/types/index';

export function recommend(participants: Participant[], meals: Meal[]): Recommendation[] {
  return participants.map((p) => {
    const candidates = meals.filter(m => m.price == null || m.price <= p.budget);
    if (!candidates.length) return { participantId:p.id, meal:null, score:0, reason:'当前资料中没有预算内且可验证的餐品。', constraints:['预算未满足'] };
    const scored = candidates.map((m) => {
      let score = 0;
      const text = `${m.name} ${m.tags.join(' ')}`.toLowerCase();
      const tastes = p.taste.join(' ').toLowerCase();
      if (tastes && text.includes(tastes)) score += 30;
      if (/蛋白|protein|肉|鸡/.test(`${p.goal} ${p.request}`) && (m.protein ?? 0) > 15) score += 25;
      if (/热量|减脂|控制/.test(`${p.goal} ${p.request}`) && (m.calories != null && m.calories < 600)) score += 25;
      if (/薯条/.test(`${p.goal} ${p.request}`) && /薯条/.test(text)) score += 42; else if (/炸/.test(`${p.goal} ${p.request}`) && /炸/.test(text)) score += 20;
      if (m.price != null) score += Math.max(0, 20 - (m.price / Math.max(1,p.budget))*10);
      score += p.hunger * 2;
      return { m, score };
    }).sort((a,b)=>b.score-a.score)[0];
    const constraints = [scored.m.price == null ? '价格暂未获取' : `价格 ${scored.m.price} 元`];
    return { participantId:p.id, meal:scored.m, score:Math.round(scored.score), reason:`根据“${p.request || p.goal || '综合诉求'}”匹配，优先保留可验证信息。`, constraints };
  });
}
