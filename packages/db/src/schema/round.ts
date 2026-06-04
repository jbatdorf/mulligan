import { pgTable, uuid, integer, date, timestamp, text } from "drizzle-orm/pg-core";
import { users } from "./user";
import { courses } from "./course";

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  score: integer("score"),
  scorecard: text("scorecard"), // URL or JSON string; structure TBD
  playedAt: date("played_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
