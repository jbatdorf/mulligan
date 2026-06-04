import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { rounds } from "db";
import { z } from "zod";

export const selectRoundSchema = createSelectSchema(rounds);

// userId is injected from auth session
export const insertRoundSchema = createInsertSchema(rounds, {
  score: (s) => s.min(18).max(250).optional(),
  playedAt: (s) => s,
}).omit({ id: true, userId: true, createdAt: true });

export const updateRoundSchema = createUpdateSchema(rounds, {
  score: (s) => s.min(18).max(250).optional(),
}).omit({ id: true, userId: true, courseId: true, createdAt: true });

export type Round = z.infer<typeof selectRoundSchema>;
export type InsertRound = z.infer<typeof insertRoundSchema>;
export type UpdateRound = z.infer<typeof updateRoundSchema>;
