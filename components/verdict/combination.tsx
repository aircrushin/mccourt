import { CouponButton } from './coupon-button';
import type { MealCombination } from '@/lib/types/index';
import { mealCategory } from '@/lib/court/recommend';

export const money = (amount: number) => `¥${amount.toFixed(2)}`;
const CATEGORY_LABEL = { main: '主食', side: '小食', drink: '饮品', set: '官方套餐', excluded: '餐品' };

export function Combination({ combination, budget, compact = false }: { combination: MealCombination; budget: number; compact?: boolean }) {
  return <div className={compact ? 'combination compact' : 'combination'}>
    <ul className="receipt-items" aria-label="组合餐品">
      {combination.items.map(item => <li key={item.id}>
        <div><span className="food-category">{CATEGORY_LABEL[mealCategory(item)]}</span><strong>{item.name}</strong><small>来源：{item.source}</small>{item.coupons?.map(coupon => <CouponButton key={coupon.name} coupon={coupon} />)}</div>
        <span className="item-price">{item.price != null ? money(item.price) : '暂未获取'}</span>
      </li>)}
    </ul>
    <div className="combo-total"><span>组合总价</span><strong>{combination.totalPrice != null ? money(combination.totalPrice) : '暂未获取'}</strong></div>
    <div className="reco-meta"><span className="meta">预算 {money(budget)}</span>
      {combination.totalPrice != null && <span className="meta">剩余 {money(Math.max(0, Math.round((budget - combination.totalPrice) * 100) / 100))}</span>}
      {!compact && <><span className="meta">总热量 {combination.calories != null ? `${combination.calories} kcal` : '暂未获取'}</span><span className="meta">总蛋白质 {combination.protein != null ? `${combination.protein} g` : '暂未获取'}</span></>}
    </div>
  </div>;
}
