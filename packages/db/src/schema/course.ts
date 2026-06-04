import { pgTable, uuid, varchar, doublePrecision, integer, real, timestamp } from "drizzle-orm/pg-core";

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  googlePlaceId: varchar("google_place_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }).notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  par: integer("par"),
  slope: integer("slope"),
  aggregateScore: real("aggregate_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
