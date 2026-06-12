import { pgTable, uuid, real, integer, text, timestamp, unique, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./user";
import { courses } from "./course";

export const sentimentEnum = pgEnum("sentiment", ["disliked", "fine", "liked"]);

export const userCourseRatings = pgTable(
  "user_course_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    initialSentiment: sentimentEnum("initial_sentiment").notNull(),
    comparisonCount: integer("comparison_count").notNull().default(0),
    photos: text("photos").array().notNull().default([]),
    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.courseId)]
);
