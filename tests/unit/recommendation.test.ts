import { describe, expect, it } from "vitest";
import { recommendMeals } from "../../lib/recommendation";
import type { MealItem, Participant } from "../../lib/types";

const participant = (overrides: Partial<Participant> = {}): Participant => ({
  id: "p1", name: "小王", budget: 30, tastes: ["chicken"], dietaryGoal: "protein", hunger: "medium", request: "想吃鸡肉", ...overrides,
});
const items: MealItem[] = [
  { id: "chicken", name: "麦辣鸡腿堡", price: 24, protein: 18, calories: 520, tags: ["鸡肉", "辣"], source: "麦当劳 MCP" },
  { id: "fries", name: "薯条（中）", price: 14, calories: 330, tags: ["薯条"], source: "麦当劳 MCP" },
];

describe("recommendMeals", () => {
  it("prioritizes a hard budget-compatible, goal-matching item", () => {
    const result = recommendMeals([participant()], items, new Date("2026-10-24T00:00:00Z"));
    expect(result.recommendations[0].item.id).toBe("chicken");
    expect(result.recommendations[0].budget.within).toBe(true);
    expect(result.recommendations[0].evidence.some((e) => e.field === "price")).toBe(true);
  });

  it("does not invent missing prices or claim budget compliance", () => {
    const result = recommendMeals([participant({ budget: 20 })], [{ id: "x", name: "神秘新品", source: "麦当劳 MCP" }]);
    expect(result.recommendations[0].budget.within).toBeNull();
    expect(result.recommendations[0].limitations).toContain("缺少实时价格，无法确认预算内");
  });

  it("reports an explicit conflict when the best available item exceeds budget", () => {
    const result = recommendMeals([participant({ budget: 10 })], [items[0]]);
    expect(result.recommendations[0].budget.within).toBe(false);
    expect(result.conflicts.join(" ")).toContain("预算");
  });

  it("keeps recommendations diverse when people have similar needs", () => {
    const result = recommendMeals([participant(), participant({ id: "p2", name: "小李" })], items);
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].item.id).not.toBe(result.recommendations[1].item.id);
  });

  it("returns a clear warning instead of fake live data when MCP is empty", () => {
    const result = recommendMeals([participant()], []);
    expect(result.recommendations).toHaveLength(0);
    expect(result.warnings.join(" ")).toContain("没有可验证的实时餐品数据");
  });
});
