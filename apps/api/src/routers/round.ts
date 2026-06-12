import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { courses, rounds, posts, userCourseRatings } from "db";
import { insertRoundSchema } from "schemas";
import { router, protectedProcedure } from "../trpc";
import { notFound, badRequest } from "../lib/errors";

const createRoundInput = insertRoundSchema.extend({
  notes: z.string().max(1000).optional(),
  hidden: z.boolean().default(false),
});

export const roundRouter = router({
  /**
   * Log a round. Requires an existing UserCourseRating for the course.
   * Inserts Round + Post atomically in one transaction.
   */
  create: protectedProcedure
    .input(createRoundInput)
    .mutation(async ({ ctx, input }) => {
      const { notes, hidden, ...roundFields } = input;

      // Verify course exists.
      const course = await ctx.db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, roundFields.courseId))
        .limit(1);
      if (!course[0]) throw notFound("Course not found");

      // A rating must already exist — you rate before you log.
      const rating = await ctx.db
        .select({ id: userCourseRatings.id })
        .from(userCourseRatings)
        .where(
          and(
            eq(userCourseRatings.userId, ctx.userId),
            eq(userCourseRatings.courseId, roundFields.courseId)
          )
        )
        .limit(1);
      if (!rating[0]) {
        throw badRequest("Rate this course before logging a round");
      }

      return ctx.db.transaction(async (tx) => {
        const [round] = await tx
          .insert(rounds)
          .values({ ...roundFields, userId: ctx.userId })
          .returning();

        const [post] = await tx
          .insert(posts)
          .values({
            userId: ctx.userId,
            courseId: roundFields.courseId,
            roundId: round.id,
            ratingId: rating[0].id,
            notes: notes ?? null,
            hidden,
          })
          .returning();

        return { round, post };
      });
    }),

  /** List all of the current user's rounds, newest first. */
  list: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(rounds)
      .where(eq(rounds.userId, ctx.userId))
      .orderBy(desc(rounds.playedAt));
  }),

  /** List the current user's rounds at a specific course, newest first. */
  listByCourse: protectedProcedure
    .input(z.object({ courseId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(rounds)
        .where(
          and(eq(rounds.userId, ctx.userId), eq(rounds.courseId, input.courseId))
        )
        .orderBy(desc(rounds.playedAt));
    }),
});
