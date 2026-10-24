import type {
  DietaryGoal,
  Evidence,
  HungerLevel,
  MealItem,
  MealRecommendation,
  Participant,
  RecommendationResult,
  Taste,
} from "./types";

const WEIGHTS = { taste: 0.3, goal: 0.25, budget: 0.2, hunger: 0.15, diversity: 0.1 } as const;

const normalize = (value: string) => value.trim().toLowerCase();
const has = (item: MealItem, terms: string[]) => {
  const haystack = [item.name, item.category, ...(item.tags ?? []), item.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.some((term) => haystack.includes(term));
};

function tasteScore(item: MealItem, tastes: Taste[]) {
  if (!tastes.length) return 0.5;
  const map: Record<Taste, string[]> = {
    beef: ["牛", "beef", "汉堡", "burger"],
    chicken: ["鸡", "chicken", "麦乐鸡", "mcchicken"],
    spicy: ["辣", "spicy"],
    sweet: ["甜", "派", "冰淇淋", "甜筒"],
    savory: ["咸", "芝士", "培根", "savory"],
    vegetarian: ["素", "vegetarian", "vegetable"],
    breakfast: ["早餐", "蛋", "麦满分", "breakfast"],
    new: ["新品", "new", "限定"],
    fries: ["薯条", "fries"],
  };
  const matches = tastes.filter((taste) => has(item, map[taste])).length;
  return matches / tastes.length;
}

function goalScore(item: MealItem, goal: DietaryGoal) {
  switch (goal) {
    case "cheap":
      return item.price == null ? 0.35 : Math.max(0, Math.min(1, 1 - item.price / 80));
    case "protein":
      return item.protein == null ? 0.35 : Math.max(0, Math.min(1, item.protein / 35));
    case "low-calorie":
      return item.calories == null ? 0.35 : Math.max(0, Math.min(1, 1 - item.calories / 900));
    case "full":
      if (item.calories != null) return Math.max(0, Math.min(1, item.calories / 850));
      return has(item, ["套餐", "double", "双", "大", "巨无霸", "饱"]) ? 0.75 : 0.4;
    case "new":
      return has(item, ["新品", "new", "限定"]) ? 1 : 0.25;
    default:
      return 0.5;
  }
}

function hungerScore(item: MealItem, hunger: HungerLevel) {
  const calories = item.calories;
  if (calories != null) {
    const target = hunger === "light" ? 350 : hunger === "high" ? 750 : 550;
    return Math.max(0, 1 - Math.abs(calories - target) / 750);
  }
  if (hunger === "high" && has(item, ["套餐", "大", "double", "双"])) return 0.8;
  return 0.5;
}

function budgetScore(item: MealItem, budget: number) {
  if (item.price == null || budget <= 0) return 0.45;
  if (item.price <= budget) return Math.max(0.4, Math.min(1, 0.85 + (budget - item.price) / Math.max(1, budget * 4)));
  return Math.max(0, 0.35 - (item.price - budget) / Math.max(1, budget * 2));
}

function hardAllowed(item: MealItem, participant: Participant) {
  const restrictions = (participant.restrictions ?? []).map(normalize);
  const haystack = [item.name, item.category, ...(item.tags ?? []), item.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return !restrictions.some((restriction) => restriction && haystack.includes(restriction));
}

function evidenceFor(item: MealItem): Evidence[] {
  const evidence: Evidence[] = [{ field: "name", value: item.name, source: item.source ?? "麦当劳 MCP" }];
  if (item.price != null) evidence.push({ field: "price", value: item.price, source: item.source ?? "麦当劳 MCP", sourceUrl: item.sourceUrl, verifiedAt: item.verifiedAt });
  if (item.calories != null) evidence.push({ field: "calories", value: item.calories, source: item.source ?? "麦当劳 MCP", sourceUrl: item.sourceUrl, verifiedAt: item.verifiedAt });
  if (item.protein != null) evidence.push({ field: "protein", value: item.protein, source: item.source ?? "麦当劳 MCP", sourceUrl: item.sourceUrl, verifiedAt: item.verifiedAt });
  return evidence;
}

function reasonFor(participant: Participant, item: MealItem) {
  const reasons: string[] = [];
  if (item.price != null && item.price <= participant.budget) reasons.push(`价格 ¥${item.price} 没有越过 ¥${participant.budget} 的预算红线`);
  else if (item.price == null) reasons.push("价格暂未从实时数据中获取");
  if (participant.dietaryGoal === "protein" && item.protein != null) reasons.push(`蛋白质 ${item.protein}g，有可核验依据`);
  if (participant.dietaryGoal === "low-calorie" && item.calories != null) reasons.push(`热量 ${item.calories}kcal，有可核验依据`);
  if (participant.tastes.length && tasteScore(item, participant.tastes) >= 0.5) reasons.push("命中主要口味诉求");
  if (!reasons.length) reasons.push("在当前可验证餐品数据中综合匹配度最高");
  return reasons.join("；");
}

export function recommendMeals(participants: Participant[], items: MealItem[], now = new Date()): RecommendationResult {
  const validItems = items.filter((item) => item.id && item.name);
  const used = new Set<string>();
  const conflicts: string[] = [];
  const warnings: string[] = [];
  const recommendations = participants.map((participant) => {
    const candidates = validItems.filter((item) => hardAllowed(item, participant));
    if (!candidates.length) {
      conflicts.push(`${participant.name} 的限制条件与当前餐品数据没有交集`);
      return null;
    }
    const diversityCandidates = candidates.some((item) => !used.has(item.id))
      ? candidates.filter((item) => !used.has(item.id))
      : candidates;
    const ranked = diversityCandidates.map((item) => {
      const diversity = used.has(item.id) ? 0 : 1;
      const score = WEIGHTS.taste * tasteScore(item, participant.tastes) +
        WEIGHTS.goal * goalScore(item, participant.dietaryGoal) +
        WEIGHTS.budget * budgetScore(item, participant.budget) +
        WEIGHTS.hunger * hungerScore(item, participant.hunger) +
        WEIGHTS.diversity * diversity;
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    const chosen = ranked[0];
    used.add(chosen.item.id);
    const limitations: string[] = [];
    if (chosen.item.price == null) limitations.push("缺少实时价格，无法确认预算内");
    if ((participant.dietaryGoal === "protein" || participant.dietaryGoal === "low-calorie") && chosen.item.calories == null && chosen.item.protein == null) {
      limitations.push("营养字段不完整，相关判断仅供参考");
    }
    if (chosen.item.source == null) warnings.push(`${chosen.item.name} 缺少来源标记`);
    const price = chosen.item.price;
    const within = price == null ? null : price <= participant.budget;
    if (within === false) conflicts.push(`${participant.name} 的预算 ¥${participant.budget} 无法覆盖当前可验证候选，已明确标注超预算`);
    const confidence = limitations.length === 0 && price != null ? "high" : limitations.length === 1 ? "medium" : "low";
    const recommendation: MealRecommendation = {
      participantId: participant.id,
      item: chosen.item,
      score: Number(chosen.score.toFixed(4)),
      reason: reasonFor(participant, chosen.item),
      budget: { limit: participant.budget, price, within, delta: price == null ? undefined : Number((price - participant.budget).toFixed(2)) },
      evidence: evidenceFor(chosen.item),
      confidence,
      limitations,
    };
    return recommendation;
  }).filter((x): x is MealRecommendation => x !== null);

  if (!validItems.length) warnings.push("当前没有可验证的实时餐品数据，无法生成真实推荐");
  return {
    recommendations,
    conflicts,
    warnings,
    generatedAt: now.toISOString(),
    dataSource: validItems.some((item) => item.source?.toLowerCase().includes("mcp")) ? "麦当劳 MCP" : "外部结构化数据，来源待核验",
  };
}
