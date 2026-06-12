import { z } from "zod";
import { eq, and, desc, or, lt, sql } from "drizzle-orm";
import { posts, users, courses, follows, likes, comments } from "db";
import { router, protectedProcedure } from "../trpc";
import { encodeCursor, decodeCursor } from "../lib/pagination";

const FEED_PAGE_SIZE = 20;

export const feedRouter = router({
  /**
   * Chronological activity feed for the current user.
   * Returns posts from followed users, excluding hidden posts.
   * Cursor-paginated on (createdAt DESC, id DESC).
   *
   * Single query — like count and comment count are aggregated in SQL,
   * not via separate round-trips.
   */
  list: protectedProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const cursor = input.cursor ? decodeCursor(input.cursor) : null;

      const rows = await ctx.db
        .select({
          id: posts.id,
          notes: posts.notes,
          createdAt: posts.createdAt,
          roundId: posts.roundId,
          ratingId: posts.ratingId,
          author: { id: users.id, name: users.name },
          course: {
            id: courses.id,
            name: courses.name,
            address: courses.address,
          },
          // Cast to int — Postgres COUNT returns bigint, which Drizzle
          // serialises as string without the cast.
          likeCount: sql<number>`cast(count(distinct ${likes.id}) as int)`,
          commentCount: sql<number>`cast(count(distinct ${comments.id}) as int)`,
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .innerJoin(courses, eq(posts.courseId, courses.id))
        .leftJoin(
          likes,
          and(eq(likes.targetType, "post"), eq(likes.targetId, posts.id))
        )
        .leftJoin(comments, eq(comments.postId, posts.id))
        .where(
          and(
            // Only posts from users the viewer follows
            sql`${posts.userId} in (
              select ${follows.followingId}
              from ${follows}
              where ${follows.followerId} = ${ctx.userId}
            )`,
            eq(posts.hidden, false),
            // Cursor — rows older than the last seen (createdAt, id) pair
            cursor
              ? or(
                  lt(posts.createdAt, cursor.createdAt),
                  and(
                    eq(posts.createdAt, cursor.createdAt),
                    lt(posts.id, cursor.id)
                  )
                )
              : undefined,
          )
        )
        .groupBy(posts.id, users.id, courses.id)
        .orderBy(desc(posts.createdAt), desc(posts.id))
        // Fetch one extra to know whether a next page exists
        .limit(FEED_PAGE_SIZE + 1);

      const hasMore = rows.length > FEED_PAGE_SIZE;
      const items = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
      const lastItem = items.at(-1);

      return {
        items,
        nextCursor:
          hasMore && lastItem
            ? encodeCursor(lastItem.createdAt, lastItem.id)
            : null,
      };
    }),
});
