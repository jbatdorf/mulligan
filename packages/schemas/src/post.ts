import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { posts } from "db";
import { z } from "zod";

export const selectPostSchema = createSelectSchema(posts);

// userId, roundId, ratingId, and courseId are set server-side
export const insertPostSchema = createInsertSchema(posts, {
  notes: (s) => s.max(1000).optional(),
}).omit({ id: true, userId: true, createdAt: true });

// Only notes and hidden are user-editable after creation
export const updatePostSchema = createUpdateSchema(posts, {
  notes: (s) => s.max(1000).optional(),
}).pick({ notes: true, hidden: true });

export type Post = z.infer<typeof selectPostSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;
