import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { sentimentEnum, userCourseRatings } from "db";
import { z } from "zod";

export const selectRatingSchema = createSelectSchema(userCourseRatings);

// userId is injected from auth session, score + comparisonCount are computed server-side
export const insertRatingSchema = createInsertSchema(userCourseRatings, {
  score: (s) => s.min(0).max(10),
}).omit({ id: true, userId: true, lastUpdated: true });

export const updateRatingSchema = createUpdateSchema(userCourseRatings, {
  score: (s) => s.min(0).max(10).optional(),
}).omit({ id: true, userId: true, courseId: true, lastUpdated: true });

export const sentimentSchema = z.enum(sentimentEnum.enumValues);

export type UserCourseRating = z.infer<typeof selectRatingSchema>;
export type InsertUserCourseRating = z.infer<typeof insertRatingSchema>;
export type UpdateUserCourseRating = z.infer<typeof updateRatingSchema>;
export type Sentiment = z.infer<typeof sentimentSchema>;