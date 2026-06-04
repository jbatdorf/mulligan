import { pgTable, uuid, timestamp, unique, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./user";

export const likeTargetEnum = pgEnum("like_target_type", ["post", "comment"]);

export const likes = pgTable(
  "likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: likeTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.targetType, t.targetId)]
);
