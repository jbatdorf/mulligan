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

// --- Rating flow (rating.start / rating.submitComparison) ---

export const startRatingInput = z.object({
  courseId: z.uuid(),
  initialSentiment: sentimentSchema,
});

export const submitComparisonInput = z.object({
  sessionId: z.uuid(),
  winnerCourseId: z.uuid().nullable(),
  loserCourseId: z.uuid().nullable(),
  tied: z.boolean(),
});

// A comparison pair to present to the user: the course being rated vs. the pivot.
export const ratingPairResult = z.object({
  done: z.literal(false),
  sessionId: z.uuid(),
  courseId: z.uuid(),
  pivotCourseId: z.uuid(),
});

// The session is complete; the course's final score and rank are known.
export const ratingFinalResult = z.object({
  done: z.literal(true),
  courseId: z.uuid(),
  score: z.number().min(0).max(10),
  rank: z.number().int().min(1),
});

export const ratingStepResult = z.discriminatedUnion("done", [
  ratingPairResult,
  ratingFinalResult,
]);

export type UserCourseRating = z.infer<typeof selectRatingSchema>;
export type InsertUserCourseRating = z.infer<typeof insertRatingSchema>;
export type UpdateUserCourseRating = z.infer<typeof updateRatingSchema>;
export type Sentiment = z.infer<typeof sentimentSchema>;
export type StartRatingInput = z.infer<typeof startRatingInput>;
export type SubmitComparisonInput = z.infer<typeof submitComparisonInput>;
export type RatingStepResult = z.infer<typeof ratingStepResult>;