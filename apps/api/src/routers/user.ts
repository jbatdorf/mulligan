import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { users, follows } from "db";
import { updateUserSchema } from "schemas";
import { router, protectedProcedure } from "../trpc";
import { notFound, forbidden } from "../lib/errors";
import type { Context } from "../context";

// ── helpers ────────────────────────────────────────────────────────────────

/** Public-safe shape — no PII, suitable for any viewer. */
const publicUser = {
  id: users.id,
  name: users.name,
  isPrivate: users.isPrivate,
  createdAt: users.createdAt,
};

/** Check whether `followerId` is currently following `followingId`. */
async function isFollowing(
  db: Context["db"],
  followerId: string,
  followingId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
    )
    .limit(1);
  return rows.length > 0;
}

// ── router ─────────────────────────────────────────────────────────────────

export const userRouter = router({
  /** Own full profile — includes email + phone. */
  me: protectedProcedure.input(z.void()).query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    if (!rows[0]) throw notFound("User not found");
    return rows[0];
  }),

  /** Public profile by ID. Private accounts return a limited shape. */
  get: protectedProcedure
    .input(z.object({ userId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select(publicUser)
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      const user = rows[0];
      if (!user) throw notFound("User not found");

      if (user.isPrivate && input.userId !== ctx.userId) {
        const follows = await isFollowing(ctx.db, ctx.userId, input.userId);
        if (!follows) {
          // Return minimal shape so the UI can render a "private account" state.
          return { id: user.id, name: user.name, isPrivate: true, createdAt: user.createdAt };
        }
      }

      return user;
    }),

  /** Update own profile. */
  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .update(users)
        .set(input)
        .where(eq(users.id, ctx.userId))
        .returning();

      if (!rows[0]) throw notFound("User not found");
      return rows[0];
    }),

  /** Follow another user. Idempotent — silently succeeds if already following. */
  follow: protectedProcedure
    .input(z.object({ userId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw forbidden("You cannot follow yourself");
      }

      // Verify target exists.
      const target = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target[0]) throw notFound("User not found");

      await ctx.db
        .insert(follows)
        .values({ followerId: ctx.userId, followingId: input.userId })
        .onConflictDoNothing();

      return { ok: true };
    }),

  /** Unfollow a user. Idempotent — silently succeeds if not following. */
  unfollow: protectedProcedure
    .input(z.object({ userId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(follows)
        .where(
          and(
            eq(follows.followerId, ctx.userId),
            eq(follows.followingId, input.userId)
          )
        );

      return { ok: true };
    }),

  /** List followers of a user. Gated on privacy. */
  followers: protectedProcedure
    .input(z.object({ userId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const target = await ctx.db
        .select({ id: users.id, isPrivate: users.isPrivate })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target[0]) throw notFound("User not found");

      if (target[0].isPrivate && input.userId !== ctx.userId) {
        const following = await isFollowing(ctx.db, ctx.userId, input.userId);
        if (!following) throw forbidden("This account is private");
      }

      const rows = await ctx.db
        .select(publicUser)
        .from(users)
        .innerJoin(follows, eq(follows.followerId, users.id))
        .where(eq(follows.followingId, input.userId));

      return rows;
    }),

  /** List who a user is following. Gated on privacy. */
  following: protectedProcedure
    .input(z.object({ userId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const target = await ctx.db
        .select({ id: users.id, isPrivate: users.isPrivate })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target[0]) throw notFound("User not found");

      if (target[0].isPrivate && input.userId !== ctx.userId) {
        const following = await isFollowing(ctx.db, ctx.userId, input.userId);
        if (!following) throw forbidden("This account is private");
      }

      const rows = await ctx.db
        .select(publicUser)
        .from(users)
        .innerJoin(follows, eq(follows.followingId, users.id))
        .where(eq(follows.followerId, input.userId));

      return rows;
    }),
});
