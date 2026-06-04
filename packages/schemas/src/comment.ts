import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { comments } from "db";
import { z } from "zod";

export const selectCommentSchema = createSelectSchema(comments);

// userId is injected from auth session
export const insertCommentSchema = createInsertSchema(comments, {
  text: (s) => s.min(1).max(500),
}).omit({ id: true, userId: true, createdAt: true });

export type Comment = z.infer<typeof selectCommentSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
