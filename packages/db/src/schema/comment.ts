import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./user";
import { posts } from "./post";

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"), // self-reference; set in relations, not FK constraint to avoid circular dep
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
