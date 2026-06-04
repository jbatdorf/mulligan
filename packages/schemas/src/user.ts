import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { users } from "db";
import { z } from "zod";

export const selectUserSchema = createSelectSchema(users);

export const insertUserSchema = createInsertSchema(users, {
  name: (s) => s.min(1).max(255),
  email: (s) => s.email().optional(),
  phone: (s) => s.min(7).max(50).optional(),
}).omit({ id: true, createdAt: true });

export const updateUserSchema = createUpdateSchema(users, {
  name: (s) => s.min(1).max(255).optional(),
  email: (s) => s.email().optional(),
  phone: (s) => s.min(7).max(50).optional(),
}).omit({ id: true, createdAt: true });

export type User = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
