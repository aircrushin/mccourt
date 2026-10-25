import { z } from 'zod';

export const ParticipantSchema = z.object({
  id: z.string(), name: z.string().min(1).max(30), budget: z.number().min(1).max(500),
  taste: z.array(z.string()).default([]), goal: z.string().default(''), hunger: z.number().int().min(1).max(5), request: z.string().max(180).default('')
});
export const MealSchema = z.object({ id: z.string(), name: z.string(), price: z.number().nullable().optional(), calories: z.number().nullable().optional(), protein: z.number().nullable().optional(), tags: z.array(z.string()).default([]), source: z.string().default('麦当劳 MCP') });
export const RecommendRequestSchema = z.object({ partyName: z.string().min(1).max(50), participants: z.array(ParticipantSchema).min(1).max(4), mode: z.enum(['live','demo']).default('live') });
export type Participant = z.infer<typeof ParticipantSchema>;
export type Meal = z.infer<typeof MealSchema>;
export type RecommendRequest = z.infer<typeof RecommendRequestSchema>;
export type MealCombination = { items: Meal[]; totalPrice: number | null; calories: number | null; protein: number | null; score: number; reason: string; constraints: string[] };
export type Recommendation = MealCombination & { participantId: string; alternatives: MealCombination[] };
export type Verdict = { caseNumber: string; caseName: string; opening: string; opinions: string[]; ruling: string; recommendations: Recommendation[]; live: boolean; sourceUpdatedAt: string | null; warning?: string; };
