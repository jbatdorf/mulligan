# Rating Engine — Architecture

*Created 2026-06-04*

How mulligan turns a user's head-to-head course comparisons into a 0–10
`UserCourseRating.score`. This is the companion to [api-design.md](./api-design.md)
(§5 "Rating flow") and assumes the data model in
[product/data-models.md](./product/data-models.md).

## 1. Decision summary

| Decision | Choice | Why |
|---|---|---|
| Scoring model | **Positional** (Beli-style) | Ordered list is the source of truth; stable order, trivial 0–10 mapping, cheap. |
| Comparison log | **Durable, append-only** | Positional doesn't read it back, but it's the raw material for a future cross-user Bradley–Terry global leaderboard. |
| Score mapping | **Pinned endpoints** within sentiment band | Worst in band = `lo`, best in band = `hi`; full range used including edges. |
| Insertion | **Binary-search insertion**, capped | ~log₂(n) comparisons; cap keeps taps bounded on large lists. |
| Session state | **Redis, transient, one per user** | Comparisons buffered, committed atomically on finalize. |

Alternatives considered (Elo, Bradley–Terry) and why they lose for the per-user
MVP: at our comparison volume they mostly reproduce the sentiment prior and then
need a lossy squash back to 0–10. Kept as a future option via the durable log.

## 2. Core concepts

**Sentiment bands.** Every rating starts with an `initial_sentiment`. Each maps to
a fixed score band (tenths precision):

| Sentiment | Band |
|---|---|
| `disliked` | `[0.0, 3.3]` |
| `fine` | `[3.4, 6.6]` |
| `liked` | `[6.7, 10.0]` |

**Ordered list.** Within each band, a user's rated courses form an ordered sequence
of **rank groups** (worst → best). Courses in the same group are ties — they share
a rank and a score. This ordering — not the numeric score — is the source of truth.
The score is *derived* from group position.

**Bands are walls.** Scoring is computed *within* a band, never across the whole
list. This guarantees a `liked` course can never numerically dip into `fine`
territory, preserving the sentiment signal. The cost: a sentiment change on
re-rate can move a score a lot (it changes bands).

## 3. Score mapping

The formula operates on **rank groups**, not individual courses. Let `g` = number
of distinct rank groups in the band, ordered worst→best at group positions `1..g`.
Pin group 1 to `lo` and group `g` to `hi`:

```
score(groupIndex) = lo + (hi − lo) · (groupIndex − 1) / (g − 1)    # round to 1 decimal
```

All courses within a group share the same score.

Special case: `g = 1` (all courses in band are tied, or only one course) → assign `lo`.

Band edges are live values — the top group of the `liked` band is always exactly
`10.0`, the bottom group of `disliked` is always exactly `0.0`.

**Worked example — `liked = [6.7, 10.0]`, no ties:**

| g | group 1 (worst) | group 2 | group 3 |
|---|---|---|---|
| 1 | **6.7** | — | — |
| 2 | 6.7 | **10.0** | — |
| 3 | 6.7 | 8.4 | **10.0** |

**Worked example — `liked = [6.7, 10.0]`, with a tie:**

Courses A and B tied at bottom, C alone at top: groups `[[A,B], [C]]`, g=2.
- group 1 → 6.7 → A=6.7, B=6.7
- group 2 → 10.0 → C=10.0

**Inherent behavior — compression.** Adding a course re-scores its whole band:
your first liked course starts at 6.7 (g=1), rises as you rank more above it,
and the top group always sits at 10.0. The *order* is rock-stable; intermediate
scores compress toward the midpoint as the band fills.

**Density cap.** A 3.3-wide band rounds to ~33 distinct tenths. Past ~33 rank
groups in one band, rounding forces score collisions; the ordered list remains
the tiebreaker. Acceptable for MVP.

## 4. Insertion algorithm

A new (or re-rated) course `X` with sentiment `s` is inserted into band `s`'s
ordered list via binary search. Let `groups = [g₁ … g_n]` (worst→best rank groups).

```
lo = 0, hi = n, comparisons = 0
while lo < hi and comparisons < CAP:
    mid   = (lo + hi) >> 1
    pivot = groups[mid]           # compare X against any course in the group
    # ask the user: X vs pivot
    if X beats pivot:   lo = mid + 1     # X is better → new group above pivot
    elif X ties pivot:  → join group at mid (early termination, see below)
    else:               hi = mid         # X is worse  → new group below pivot
    comparisons += 1
insertionIndex = lo            # if capped early, use (lo + hi) >> 1 (approximate)
```

**Tie handling (early termination).** If the user picks "equally liked" against
the pivot, X joins that rank group — the search stops immediately and `comparison_count`
reflects comparisons answered so far. One exception: **ties are not allowed when
the pivot is the top group of the `liked` band** (group `n-1` in a 0-indexed liked
session). The API rejects the tie response in this case, forcing a definitive choice.
This enforces that exactly one course holds `10.0` at all times.

- **Comparisons needed:** `ceil(log₂(n + 1))` to fully resolve (no tie).
- **CAP:** a tunable constant (suggested default **5**). When the cap is hit before
  `lo == hi`, the course is placed at the midpoint of the remaining range —
  placement is approximate but bounded-tap. *(Open: confirm default, §13.)*
- **Pivot selection is deterministic** (`mid`), which makes sessions resumable and
  the engine unit-testable.
- Only band `s` is touched, so only band `s` is re-scored.

**Sanity trace** — `groups = [[A], [B]]` (A worst), insert X:
- X beats B → index 2 → `[[A], [B], [X]]` (X best, 10.0)
- X ties B → join B's group → `[[A], [B, X]]` (B and X share top score)
- X loses B, beats A → index 1 → `[[A], [X], [B]]`
- X loses B, ties A → join A's group → `[[A, X], [B]]`
- X loses B, loses A → index 0 → `[[X], [A], [B]]` (X worst)

## 5. Session lifecycle

Rating is a short server-driven session, not a single request. State lives in
**Redis** with a TTL (e.g. 1h); abandoned sessions expire with zero DB trace.

**Constraint: at most one open session per user.** `rating.start` rejects if one
is already live. This prevents two concurrent inserts from racing on the same
ordered list, so the band snapshot taken at start stays valid through finalize.

Session shape:

```ts
{
  sessionId: string,
  userId: string,
  courseId: string,               // the course being (re-)rated
  sentiment: Sentiment,
  bandSnapshot: string[][],       // ordered rank groups [[courseId, ...], ...]
                                  //   in target band at start, excluding courseId
  lo: number, hi: number,         // current binary search range over group indices
  answered: {
    courseAId: string,              // the two compared courses
    courseBId: string,
    winnerCourseId: string | null,  // null when tied
    tied: boolean,
  }[],                              // buffered, not yet persisted
  createdAt: string,
}
```

## 6. API flow

Maps onto the `rating` router in [api-design.md](./api-design.md):

1. **`rating.start({ courseId, initialSentiment })`**
   - Reject if the user has an open session.
   - Load the target band's ordered list, exclude `courseId` → `bandSnapshot`.
   - Init `lo=0, hi=len`. If `lo == hi` (empty band) → finalize immediately
     (0 comparisons). Else return `{ sessionId, pivotCourseId }`.

2. **`rating.submitComparison({ sessionId, winnerCourseId, loserCourseId, tied })`**
   - Validate the answer is against the current pivot; append to `answered`.
   - If `tied` and pivot is the top group of a `liked` session → reject with
     `BAD_REQUEST` ("Only one course can hold 10.0 — pick a winner").
   - If `tied` → join pivot's group, finalize immediately.
   - Else advance `lo/hi`. If `lo < hi` and under cap → return next `{ pivotCourseId }`.
   - Otherwise → **finalize** (§7) and return `{ score, rank }`.

## 7. Finalization (one transaction)

Once `insertionIndex` is known:

1. Build the new ordered band: insert `courseId` as a new singleton group at
   `insertionIndex`, or merge into an existing group on a tie.
2. Recompute scores for **every** course in that band (g changed → all shift).
3. In a single DB transaction:
   - upsert `UserCourseRating` for `courseId` (`score`, `initial_sentiment`,
     `comparison_count = answered.length`) — unique on `(user_id, course_id)`,
     updated in place on re-rate.
   - update `score` for the other band members whose value changed.
   - insert the buffered `answered` rows into `Comparison` (durable log).
4. Delete the Redis session.
5. Enqueue background `aggregate_score` recompute jobs for affected courses (§9).

## 8. Re-rate semantics

When re-rating an already-rated course `Y`:

1. Remove `Y` from its current band; re-score that band (others shift up).
2. Resolve the new target band from the new sentiment (may differ from the old).
3. Binary-insert `Y` into the target band — `Y` is already excluded, satisfying
   "re-rating excludes the course being re-rated from comparisons."
4. Re-score the target band; `comparison_count` reflects the new insertion.
5. Old `Comparison` rows stay in the log with their original timestamps (the log
   is append-only); new comparisons are appended. Only the current `score` is kept
   on `UserCourseRating`.

If old and new band differ, both bands are re-scored in the finalize transaction.

## 9. Aggregate score interaction

A band insert can change many `UserCourseRating.score` values, and
`Course.aggregate_score = AVG(UserCourseRating.score)` is cross-user. So
finalization only *enqueues* recompute jobs (BullMQ) per affected course; the
average is computed off the request path and debounced. The rating engine never
computes `aggregate_score` synchronously.

## 10. Edge cases

| Case | Behavior |
|---|---|
| First-ever rating / empty band | 0 comparisons, `comparison_count = 0`, score = `lo` (g=1 special case). |
| Cap reached before resolution | Insert as new singleton group at remaining-range midpoint; placement approximate. |
| Score collisions after rounding | Allowed; ordered group list is the tiebreaker. Display may dedupe. |
| Session expires mid-flow | Session gone, no DB writes; user restarts `rating.start`. |
| Concurrent rate attempt | Rejected — one open session per user. |
| Re-rate across bands | Both old and new bands re-scored in one transaction. |
| Tie against top `liked` group | Rejected — only one course may hold `10.0`. |
| Tie in non-`liked` band | Allowed; tied courses share the group score. |

## 11. Module boundaries

`rating-engine.ts` — **pure, no I/O, fully unit-testable:**
- `bandFor(sentiment): [lo, hi]`
- `nextPivot(state): { pivotGroupIndex } | { done, insertionIndex, joinGroup }`
- `applyAnswer(state, outcome: 'win' | 'loss' | 'tie'): state`
- `insertGroup(groups, courseId, index): groups`  *(new singleton group)*
- `joinGroup(groups, courseId, groupIndex): groups`  *(tie merge)*
- `scoreBand(groups, [lo, hi]): Map<courseId, score>`

`rating.service.ts` — wires the pure engine to Redis (session) and `db`
(read band list, finalize transaction, enqueue jobs). Routers only validate +
orchestrate.

## 12. Future enhancements

- **"The 10" — a single perfect 10.0.** With pinned endpoints and the tie guard
  already in place, `10.0` is always held by exactly one course (the top of the
  `liked` band). The feature is purely about **UX**: surfacing the crown, the
  "you haven't found your 10 yet" empty state (before any liked course exists),
  and the crown-transfer moment when a new course dethrones #1. No engine changes
  needed — the score and uniqueness constraint already work.
- **Cross-user global leaderboard via Bradley–Terry** over the pooled `Comparison`
  log — where comparison volume and intransitivity actually justify the model.
- **Cross-band boundary refinement** — optionally compare against an adjacent band's
  edge to sharpen boundary placement (MVP stays strictly within-band).
- **Cap tuning** — revisit the comparison `CAP` with real usage data.

## 13. Open questions

- Confirm `CAP` default (suggested 5) and the approximate-placement rule when capped.
- Redis session TTL value.
- Whether `rating.start` returning `{ rank }` / a leaderboard preview is worth the
  extra read on finalize.
