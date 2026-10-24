export type Taste = "beef" | "chicken" | "spicy" | "sweet" | "savory" | "vegetarian" | "breakfast" | "new" | "fries";
export type DietaryGoal = "cheap" | "protein" | "low-calorie" | "full" | "new" | "none";
export type HungerLevel = "light" | "medium" | "high";

export interface Participant {
  id: string;
  name: string;
  budget: number;
  tastes: Taste[];
  dietaryGoal: DietaryGoal;
  hunger: HungerLevel;
  request: string;
  restrictions?: string[];
  appealReason?: string;
}

export interface MealItem {
  id: string;
  name: string;
  price?: number;
  calories?: number;
  protein?: number;
  tags?: string[];
  category?: string;
  description?: string;
  source?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  imageUrl?: string;
}

export interface Evidence {
  field: "price" | "calories" | "protein" | "name" | "availability";
  value: string | number;
  source: string;
  sourceUrl?: string;
  verifiedAt?: string;
}

export interface MealRecommendation {
  participantId: string;
  item: MealItem;
  score: number;
  reason: string;
  budget: { limit: number; price?: number; within: boolean | null; delta?: number };
  evidence: Evidence[];
  confidence: "high" | "medium" | "low";
  limitations: string[];
}

export interface RecommendationResult {
  recommendations: MealRecommendation[];
  conflicts: string[];
  warnings: string[];
  generatedAt: string;
  dataSource: string;
}
