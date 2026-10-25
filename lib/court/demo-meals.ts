import type { Meal } from '@/lib/types/index';

// Fixed fixtures are always labelled and never used as live MCP evidence.
export const demoMeals: Meal[] = [
  { id:'demo-burger', name:'经典牛肉汉堡（体验案例）', price:18, calories:420, protein:20, tags:['肉','饱腹'], source:'体验案例资料' },
  { id:'demo-chicken', name:'香辣鸡腿堡（体验案例）', price:22, calories:510, protein:25, tags:['鸡肉','蛋白质'], source:'体验案例资料' },
  { id:'demo-fries', name:'薯条（体验案例）', price:12, calories:320, protein:4, tags:['薯条','快乐'], source:'体验案例资料' },
  { id:'demo-salad', name:'清爽沙拉（体验案例）', price:16, calories:210, protein:8, tags:['低卡','控制热量'], source:'体验案例资料' },
  { id:'demo-drink', name:'无糖茶（体验案例）', price:6, calories:0, protein:0, tags:['饮品'], source:'体验案例资料' },
];
