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

// A Google Places candidate selected from search, used to get-or-create a
// course row at rating time. Mirrors PlaceCandidate from the places service.
export const placeCandidateSchema = z.object({
  googlePlaceId: z.string().min(1),
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  lat: z.number(),
  lng: z.number(),
  par: z.number().int().min(3).max(36).optional(),
  slope: z.number().int().min(55).max(155).optional(),
});

export type Course = z.infer<typeof selectCourseSchema>;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type UpdateCourse = z.infer<typeof updateCourseSchema>;
export type PlaceCandidate = z.infer<typeof placeCandidateSchema>;
