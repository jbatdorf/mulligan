import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { courses } from "db";
import { z } from "zod";

export const selectCourseSchema = createSelectSchema(courses);

export const insertCourseSchema = createInsertSchema(courses, {
  name: (s) => s.min(1).max(255),
  address: (s) => s.min(1).max(500),
  par: (s) => s.min(3).max(36).optional(),
  slope: (s) => s.min(55).max(155).optional(), // USGA slope range
}).omit({ id: true, createdAt: true, aggregateScore: true });

export const updateCourseSchema = createUpdateSchema(courses, {
  par: (s) => s.min(3).max(36).optional(),
  slope: (s) => s.min(55).max(155).optional(),
}).omit({ id: true, createdAt: true, googlePlaceId: true });

export type Course = z.infer<typeof selectCourseSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type UpdateCourse = z.infer<typeof updateCourseSchema>;
