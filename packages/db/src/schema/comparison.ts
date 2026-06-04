import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { users } from "./user";
import { courses } from "./course";

export const comparisons = pgTable("comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  winnerCourseId: uuid("winner_course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  loserCourseId: uuid("loser_course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
