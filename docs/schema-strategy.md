# Schema Strategy

## Layers

```
PostgreSQL (source of truth)
  └── packages/db          — Drizzle table & enum definitions
        └── packages/schemas — Zod schemas derived from Drizzle
              ├── apps/api   — validates requests/responses
              ├── apps/web   — form validation, inferred types
              └── apps/mobile
```

## Rules

1. **Define once in `packages/db`.** Tables, columns, and enums live here as Drizzle definitions. Nothing else invents types independently.

2. **Derive Zod schemas in `packages/schemas`.** Import `.enumValues` and `$inferSelect` / `$inferInsert` from `packages/db` and wrap them in Zod:

   ```ts
   // packages/schemas/src/rating.ts
   import { sentimentEnum, userCourseRatings } from "db";
   import { z } from "zod";

   export const SentimentSchema = z.enum(sentimentEnum.enumValues);
   export type Sentiment = z.infer<typeof SentimentSchema>;

   export const InsertRatingSchema = z.object({
     userId: z.uuid(),
     courseId: z.uuid(),
     score: z.number().min(0).max(10),
     initialSentiment: SentimentSchema,
   });
   ```

3. **API validates at the boundary.** Route handlers import from `packages/schemas` to parse and type request bodies. Drizzle is only imported in `packages/db` and server-side data-access code — never in the UI.

4. **UI only sees Zod types.** Apps import schemas and inferred types from `packages/schemas`. No Drizzle or `pg` dependencies in `apps/web` or `apps/mobile`.

## Data flow

```
Request body
  → z.parse (packages/schemas)   — throws 400 on invalid input
  → data-access layer (packages/db) — Drizzle query, typed by $inferInsert
  → response                     — typed by $inferSelect, optionally re-validated
  → UI                           — consumes inferred TypeScript types
```

## Adding an enum value

1. Add the value to `pgEnum(...)` in `packages/db`.
2. Generate + run a migration (`db:generate`, `db:migrate`).
3. `SentimentSchema` (and any type derived from it) updates automatically — no other changes needed.
