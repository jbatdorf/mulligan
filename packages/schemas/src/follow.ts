import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { follows } from "db";
import { z } from "zod";

export const selectFollowSchema = createSelectSchema(follows);

// Only followingId comes from the client — followerId is injected from auth session
export const insertFollowSchema = createInsertSchema(follows).pick({
  followingId: true,
});

export type Follow = z.infer<typeof selectFollowSchema>;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
