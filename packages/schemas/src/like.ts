import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { likes } from "db";
import { z } from "zod";

export const selectLikeSchema = createSelectSchema(likes);

// userId is injected from auth session
export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type Like = z.infer<typeof selectLikeSchema>;
export type InsertLike = z.infer<typeof insertLikeSchema>;
