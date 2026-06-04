# API Layer — High-Level Design

*Created 2026-06-04*

The API is the single backend for `apps/mobile` (Expo) and `apps/web` (Next.js).
It owns all business logic and is the only consumer of `packages/db`. UI clients
only ever see types/schemas from `packages/schemas`.

## 1. Stack

| Choice | Rationale |
|---|---|
| **Fastify v5** | HTTP server, Pino logging, plugin/hook model for auth + rate limiting |
| **tRPC v11** | End-to-end type safety into Expo + Next with no codegen. Decided for MVP. GraphQL/REST stay later enhancements |
| **Zod (from `packages/schemas`)** | tRPC `.input()` reuses the existing Drizzle-derived Zod schemas — one source of truth for validation + types |

Decisions locked in this pass:
- **tRPC only** for the MVP surface.
- **Rating comparison state is server-side transient** (Redis) — the algorithm stays authoritative.
- **Auth is abstracted behind an interface**, stubbed now, real provider (Clerk/Auth0) plugged in later without touching routers.

## 2. Package structure

```
apps/api/src/
├── index.ts              # Fastify bootstrap, plugin registration, listen
├── trpc.ts               # initTRPC, procedure builders (public / protected)
├── context.ts            # createContext: resolve user via AuthProvider, attach db
├── router.ts             # appRouter — merges domain routers; exports AppRouter type
├── routers/
│   ├── user.ts           # profile get/update, follow / unfollow, followers / following
│   ├── course.ts         # search (Google Places), get, personal leaderboard
│   ├── rating.ts         # start → submitComparison → final score
│   ├── round.ts          # log a round (auto-creates post, single tx)
│   ├── feed.ts           # chronological activity feed (cursor paginated)
│   └── post.ts           # get, update (notes/hidden), comments, likes
├── services/             # business logic — pure, testable, no HTTP/tRPC types
│   ├── rating-engine.ts  # comparison pair selection + score computation
│   ├── feed.service.ts   # feed query assembly
│   └── places.service.ts # Google Places lookup + course upsert-on-first-rating
└── lib/
    ├── auth.ts           # AuthProvider interface + stub implementation
    ├── errors.ts         # domain → tRPC error mapping
    └── pagination.ts     # cursor encode/decode helpers
```

**Layering rule:** routers do validation + auth + orchestration only. Real logic
lives in `services/`. All DB access goes through Drizzle in the `db` package.

## 3. Context & auth

`createContext` runs per request:

1. Reads the bearer token from the request.
2. Calls `AuthProvider.verify(token)` → `{ userId } | null`.
3. Returns `{ db, userId }`.

```ts
// lib/auth.ts
export interface AuthProvider {
  verify(token: string | undefined): Promise<{ userId: string } | null>;
}
// Stub now (e.g. reads a dev header / signed test token).
// Clerk or Auth0 implementation drops in later — routers never change.
```

Two procedure builders in `trpc.ts`:
- `publicProcedure` — open endpoints (rare; non-users cannot see posts).
- `protectedProcedure` — middleware throws `UNAUTHORIZED` when `userId` is null;
  downstream handlers get a guaranteed non-null `userId`. Privacy enforcement
  (`is_private`, follower-gating) layers on top here.

## 4. Router map

| Router | Procedures (MVP) | Notes |
|---|---|---|
| `user` | `me`, `get`, `update`, `follow`, `unfollow`, `followers`, `following` | Respect `is_private` |
| `course` | `search`, `get`, `leaderboard` | `search` hits Google Places; `leaderboard` = user's rated courses ordered by score |
| `rating` | `start`, `submitComparison`, `get` | Multi-step flow, see §5 |
| `round` | `create`, `list` | `create` is one transaction: Round + Post (+ rating linkage) |
| `feed` | `list` | Cursor paginated, followed users, excludes `hidden` |
| `post` | `get`, `update`, `comment`, `deleteComment`, `like`, `unlike` | Comments threaded via `parent_id`; likes polymorphic (post/comment) |

## 5. Key flows

### Rating (the core flow)
Not a single POST — a short server-driven session:

1. `rating.start({ courseId, initialSentiment })`
   → opens a transient comparison session (Redis), returns the first comparison
   pair (new course vs. a previously-rated course). Re-rating excludes the course
   being re-rated from the candidate pool.
2. `rating.submitComparison({ sessionId, winnerCourseId, loserCourseId })`
   → persists a `Comparison` row, then returns **either** the next pair **or** the
   final computed score once enough comparisons exist.
3. On completion, upsert `UserCourseRating` (`unique(user_id, course_id)`,
   updated in place on re-rate) with the computed `score`, `initial_sentiment`,
   and `comparison_count`.

`rating-engine.ts` owns pair selection and score computation (binary-insertion /
Elo-style) — pure functions over comparison results, independently testable.

### Round → Post
`round.create` runs in a single Drizzle transaction:
- insert `Round`
- attach `rating_id` (first play requires a rating; later rounds carry forward the
  existing `UserCourseRating`)
- auto-create the `Post` (`hidden` from the round-log checkbox)

### Feed
`feed.list` = cursor-based pagination keyed on `(created_at, id)`, filtered to the
viewer's followed users, excluding `hidden` posts. Chronological only for MVP.

## 6. Cross-cutting

- **Validation/errors:** Zod failures → `BAD_REQUEST`; domain errors → typed tRPC
  errors via `lib/errors.ts`; Pino logs request lifecycle.
- **Pagination:** opaque cursor helper in `lib/pagination.ts`.
- **Background work (out of API request path):** `aggregate_score` recompute,
  push notifications, search indexing → BullMQ workers under `services/`.
- **Search:** Google Places behind `places.service`. Algolia/Typesense later.
- **Caching/sessions:** Redis backs rating sessions now; hot feeds/trending later.

## 7. Out of scope for this pass
Auth provider wiring, BullMQ workers, recommendations microservice, Algolia
indexing, GraphQL. All have seams designed in above.
