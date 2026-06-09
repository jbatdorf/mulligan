import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { userCourseRatings } from "db";
import { startRatingInput, submitComparisonInput } from "schemas";
import { router, protectedProcedure } from "../trpc";
import { notFound } from "../lib/errors";
import { startSession, submitComparison } from "../services/rating.service";

export const ratingRouter = router({
  /** Open a comparison session and return the first pair (or finalize if the band is empty). */
  start: protectedProcedure
    .input(startRatingInput)
    .mutation(({ ctx, input }) =>
      startSession(ctx.userId, input.courseId, input.initialSentiment)
    ),

  /** Record a comparison answer; returns the next pair or the final score. */
  submitComparison: protectedProcedure
    .input(submitComparisonInput)
    .mutation(({ ctx, input }) => submitComparison(ctx.userId, input)),

  /** Get the current user's rating for a course. */
  get: protectedProcedure
    .input(z.object({ courseId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const [rating] = await ctx.db
        .select()
        .from(userCourseRatings)
        .where(
          and(
            eq(userCourseRatings.userId, ctx.userId),
            eq(userCourseRatings.courseId, input.courseId)
          )
        )
        .limit(1);
      if (!rating) throw notFound("No rating for this course");
      return rating;
    }),
});
