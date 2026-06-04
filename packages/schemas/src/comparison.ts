import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { comparisons } from "db";
import { z } from "zod";

export const selectComparisonSchema = createSelectSchema(comparisons);

// userId is injected from auth session
// winnerCourseId is null when tied = true
export const insertComparisonSchema = createInsertSchema(comparisons).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type Comparison = z.infer<typeof selectComparisonSchema>;
export type InsertComparison = z.infer<typeof insertComparisonSchema>;
