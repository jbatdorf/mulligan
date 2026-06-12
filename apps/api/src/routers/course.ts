import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { courses, userCourseRatings } from "db";
import { placeCandidateSchema } from "schemas";
import { router, protectedProcedure } from "../trpc";
import { notFound } from "../lib/errors";
import { stubPlacesService } from "../services/places.service";

export const courseRouter = router({
  /**
   * Search for golf courses via Google Places.
   * Returns place candidates — the selected course is upserted into the DB
   * at rating time (rating.start), not here.
   */
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return stubPlacesService.search(input.query);
    }),

  /**
   * Get-or-create a course from a selected Places candidate.
   * Upserts by `googlePlaceId` (the unique key) and returns the course row,
   * giving the client the internal `courseId` that `rating.start` requires.
   */
  getOrCreateFromPlace: protectedProcedure
    .input(placeCandidateSchema)
    .mutation(async ({ ctx, input }) => {
      const [course] = await ctx.db
        .insert(courses)
        .values(input)
        .onConflictDoUpdate({
          target: courses.googlePlaceId,
          // Refresh place-sourced fields; never clobber computed columns.
          set: {
            name: input.name,
            address: input.address,
            lat: input.lat,
            lng: input.lng,
          },
        })
        .returning();

      return course;
    }),

  /** Get a course by its internal ID. */
  get: protectedProcedure
    .input(z.object({ courseId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(courses)
        .where(eq(courses.id, input.courseId))
        .limit(1);

      if (!rows[0]) throw notFound("Course not found");
      return rows[0];
    }),

  /**
   * The current user's personal course leaderboard —
   * all rated courses ordered by their score, highest first.
   */
  leaderboard: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: courses.id,
        name: courses.name,
        address: courses.address,
        lat: courses.lat,
        lng: courses.lng,
        par: courses.par,
        slope: courses.slope,
        aggregateScore: courses.aggregateScore,
        score: userCourseRatings.score,
        initialSentiment: userCourseRatings.initialSentiment,
        comparisonCount: userCourseRatings.comparisonCount,
        photos: userCourseRatings.photos,
        ratingLastUpdated: userCourseRatings.lastUpdated,
      })
      .from(userCourseRatings)
      .innerJoin(courses, eq(userCourseRatings.courseId, courses.id))
      .where(eq(userCourseRatings.userId, ctx.userId))
      .orderBy(desc(userCourseRatings.score));

    return rows;
  }),
});
