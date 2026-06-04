import { pgTable, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./user";
import { courses } from "./course";

export const comparisons = pgTable("comparisons", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseAId: uuid("course_a_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  courseBId: uuid("course_b_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  winnerCourseId: uuid("winner_course_id")
    .references(() => courses.id, { onDelete: "cascade" }),
  tied: boolean("tied").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
