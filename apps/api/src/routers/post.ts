import { z } from "zod";
import { eq, and, count } from "drizzle-orm";
import { posts, users, courses, comments, likes } from "db";
import { insertCommentSchema } from "schemas";
import { router, protectedProcedure } from "../trpc";
import { notFound, forbidden } from "../lib/errors";

export const postRouter = router({
  /**
   * Get a post with its author, course, like count, and flat comment list.
   * Comments are returned flat — client threads via parentId.
   */
  get: protectedProcedure
    .input(z.object({ postId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      // Post + author + course
      const rows = await ctx.db
        .select({
          id: posts.id,
          notes: posts.notes,
          hidden: posts.hidden,
          createdAt: posts.createdAt,
          roundId: posts.roundId,
          ratingId: posts.ratingId,
          author: { id: users.id, name: users.name },
          course: {
            id: courses.id,
            name: courses.name,
            address: courses.address,
          },
        })
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .innerJoin(courses, eq(posts.courseId, courses.id))
        .where(eq(posts.id, input.postId))
        .limit(1);

      const post = rows[0];
      if (!post) throw notFound("Post not found");

      // Like count
      const [likeRow] = await ctx.db
        .select({ count: count() })
        .from(likes)
        .where(
          and(eq(likes.targetType, "post"), eq(likes.targetId, input.postId))
        );

      // Comments with authors
      const postComments = await ctx.db
        .select({
          id: comments.id,
          text: comments.text,
          parentId: comments.parentId,
          createdAt: comments.createdAt,
          author: { id: users.id, name: users.name },
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.postId, input.postId));

      return {
        ...post,
        likeCount: likeRow?.count ?? 0,
        comments: postComments,
      };
    }),

  /** Update a post's notes or hidden flag. Owner only. */
  update: protectedProcedure
    .input(
      z.object({
        postId: z.string().uuid(),
        notes: z.string().max(1000).nullish(),
        hidden: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { postId, notes, hidden } = input;

      const existing = await ctx.db
        .select({ userId: posts.userId })
        .from(posts)
        .where(eq(posts.id, postId))
        .limit(1);

      if (!existing[0]) throw notFound("Post not found");
      if (existing[0].userId !== ctx.userId) throw forbidden("Not your post");

      // Only include fields explicitly provided by the caller.
      const fields = {
        ...(notes !== undefined && { notes }),
        ...(hidden !== undefined && { hidden }),
      };

      const [updated] = await ctx.db
        .update(posts)
        .set(fields)
        .where(eq(posts.id, postId))
        .returning();

      return updated;
    }),

  /** Add a comment to a post. Set parentId for replies. */
  addComment: protectedProcedure
    .input(insertCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify post exists
      const post = await ctx.db
        .select({ id: posts.id })
        .from(posts)
        .where(eq(posts.id, input.postId))
        .limit(1);
      if (!post[0]) throw notFound("Post not found");

      // Verify parent comment belongs to the same post (if this is a child comment)
      if (input.parentId) {
        const parent = await ctx.db
          .select({ postId: comments.postId })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .limit(1);
        if (!parent[0]) throw notFound("Parent comment not found");
        if (parent[0].postId !== input.postId) {
          throw forbidden("Parent comment does not belong to this post");
        }
      }

      const [comment] = await ctx.db
        .insert(comments)
        .values({ ...input, userId: ctx.userId })
        .returning();

      return comment;
    }),

  /** Delete own comment. */
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ userId: comments.userId })
        .from(comments)
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!existing[0]) throw notFound("Comment not found");
      if (existing[0].userId !== ctx.userId) throw forbidden("Not your comment");

      await ctx.db
        .delete(comments)
        .where(eq(comments.id, input.commentId));

      return { ok: true };
    }),

  /** Like a post or comment. Idempotent. */
  like: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["post", "comment"]),
        targetId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(likes)
        .values({ ...input, userId: ctx.userId })
        .onConflictDoNothing();

      return { ok: true };
    }),

  /** Unlike a post or comment. Idempotent. */
  unlike: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["post", "comment"]),
        targetId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(likes)
        .where(
          and(
            eq(likes.userId, ctx.userId),
            eq(likes.targetType, input.targetType),
            eq(likes.targetId, input.targetId)
          )
        );

      return { ok: true };
    }),
});
