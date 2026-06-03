# Data Models

---

## Course

Courses are created on first rating. Name, address, lat/lng, and `google_place_id` are populated via Google Places at search time. Golf-specific fields are optionally provided by the user at time of first rating.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `google_place_id` | string | From Google Places API; unique; used to prevent duplicates |
| `name` | string | |
| `address` | string | |
| `lat` | float | |
| `lng` | float | |
| `par` | int | Nullable; optionally provided by user at first rating |
| `slope` | int | Nullable; USGA slope rating; optionally provided by user at first rating |
| `aggregate_score` | float | Nullable; computed average of all `UserCourseRating.score`; updated via background job |
| `created_at` | datetime | |

---

## User

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `is_private` | bool | Default: false |

**Relationships:** has many `Round`, has many `UserCourseRating`, has many `Follow` (as follower and following)

---

## Follow

Junction table representing a user following another user.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `follower_id` | uuid | FK → User |
| `following_id` | uuid | FK → User |
| `created_at` | datetime | |

**Constraint:** `follower_id ≠ following_id`

---

## UserCourseRating

The computed rating a user has assigned to a course, derived from pairwise comparisons. Updated in place on re-rate — only the current score is kept. Re-rating excludes the course being re-rated from comparisons.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `course_id` | uuid | FK → Course |
| `score` | float | 0.0–10.0, tenths precision |
| `initial_sentiment` | enum | `disliked` \| `fine` \| `liked` |
| `comparison_count` | int | Number of comparisons used to compute this score |
| `photos` | string[] | Array of URLs; photos are attached to the rating, not the round |
| `last_updated` | datetime | |

**Constraint:** unique on `(user_id, course_id)`

**Rating flow:** User is first asked their initial sentiment ("disliked / fine / liked"), then prompted to compare the new course head-to-head against previously rated courses. Once enough comparisons are made, a 0–10 score is assigned.

---

## Comparison

A single head-to-head comparison event between two courses by a user. The underlying data the ranking algorithm reads to compute `UserCourseRating.score`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `winner_course_id` | uuid | FK → Course |
| `loser_course_id` | uuid | FK → Course |
| `created_at` | datetime | |

---

## Round

A single instance of a user playing a course. Created every time a user logs a play, regardless of whether they re-rate. Each Round auto-creates one Post.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `course_id` | uuid | FK → Course |
| `score` | int | Strokes played (optional) |
| `scorecard` | jsonb / url | Optional; TBD whether structured or photo upload |
| `played_at` | date | |
| `created_at` | datetime | |

**Use cases:** `AVG(score) WHERE user_id = ? AND course_id = ?` for average score at a course; full play history per user.

---

## Post

Auto-created whenever a `Round` is logged. Visible in the activity feed unless `hidden` is true.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `course_id` | uuid | FK → Course |
| `round_id` | uuid | FK → Round; always present |
| `rating_id` | uuid | FK → UserCourseRating; always present — first play requires a rating; subsequent rounds without re-rating carry forward the existing rating |
| `notes` | text | Optional |
| `hidden` | bool | Default: false; set at round-log time via "hide from feed" checkbox. Hidden posts excluded from activity feed but visible on personal leaderboard. |
| `created_at` | datetime | |

**Relationships:** has many `Comment`, has many `Like`

---

## Comment

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `post_id` | uuid | FK → Post |
| `parent_id` | uuid | FK → Comment (null if top-level) |
| `text` | text | |
| `created_at` | datetime | |

**Relationships:** has many `Like`

---

## Like

Polymorphic — can belong to a `Post` or a `Comment`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `target_type` | enum | `post` \| `comment` |
| `target_id` | uuid | FK → Post or Comment |
| `created_at` | datetime | |

**Constraint:** unique on `(user_id, target_type, target_id)`

---

## Achievement *(future)*

Awarded to users based on play history milestones (e.g. played courses in 10 states, played 10 courses in one state).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK → User |
| `type` | enum | e.g. `traveler_1`, `state_master_1` |
| `awarded_at` | datetime | |
