import type { Sentiment } from "schemas";

/**
 * Pure rating engine — no I/O, fully unit-testable.
 * Implements the positional scoring model from docs/rating-engine.md (§3–§4).
 *
 * A band's ordered list is an array of rank groups, worst → best. Each group is
 * a list of course IDs that tie (share a rank and a score). The ordering — not
 * the numeric score — is the source of truth; scores are derived from position.
 */

export type RankGroups = string[][];

/** Sentiment → fixed score band [lo, hi] (tenths precision). */
export const BANDS: Record<Sentiment, readonly [number, number]> = {
  disliked: [0.0, 3.3],
  fine: [3.4, 6.6],
  liked: [6.7, 10.0],
};

export function bandFor(sentiment: Sentiment): readonly [number, number] {
  return BANDS[sentiment];
}

/** Default comparison cap — bounds taps on large lists (doc §4). */
export const CAP = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Derive a score for every course in a band from its group position.
 * Pins group 1 to `lo` and group `g` to `hi`; `g === 1` → everything at `lo`.
 */
export function scoreBand(
  groups: RankGroups,
  [lo, hi]: readonly [number, number]
): Map<string, number> {
  const scores = new Map<string, number>();
  const g = groups.length;
  groups.forEach((group, i) => {
    const score = g === 1 ? lo : round1(lo + (hi - lo) * (i / (g - 1)));
    for (const courseId of group) scores.set(courseId, score);
  });
  return scores;
}

export type PivotResult =
  | { done: false; pivotGroupIndex: number }
  | { done: true; insertionIndex: number };

/** Next deterministic pivot for the binary search over group indices [lo, hi). */
export function nextPivot(lo: number, hi: number): PivotResult {
  if (lo < hi) return { done: false, pivotGroupIndex: (lo + hi) >> 1 };
  return { done: true, insertionIndex: lo };
}

export type Outcome = "win" | "loss" | "tie";

/**
 * Advance the binary-search range given the outcome of comparing the rated
 * course X against the pivot group at `mid`.
 * - win  → X is better → search above the pivot
 * - loss → X is worse  → search below the pivot
 * - tie  → X joins the pivot group (caller terminates; `tieAt` is that index)
 */
export function applyAnswer(
  lo: number,
  hi: number,
  mid: number,
  outcome: Outcome
): { lo: number; hi: number; tieAt?: number } {
  switch (outcome) {
    case "win":
      return { lo: mid + 1, hi };
    case "loss":
      return { lo, hi: mid };
    case "tie":
      return { lo, hi, tieAt: mid };
  }
}

/** Whether the comparison cap has been reached (doc §4). */
export function isCapped(comparisons: number, cap = CAP): boolean {
  return comparisons >= cap;
}

/** Approximate placement when capped before lo === hi (doc §4, §10). */
export function approxInsertionIndex(lo: number, hi: number): number {
  return (lo + hi) >> 1;
}

/** Insert a course as a new singleton rank group at `index`. */
export function insertGroup(
  groups: RankGroups,
  courseId: string,
  index: number
): RankGroups {
  const next = groups.map((g) => [...g]);
  next.splice(index, 0, [courseId]);
  return next;
}

/** Merge a course into an existing rank group (tie). */
export function joinGroup(
  groups: RankGroups,
  courseId: string,
  groupIndex: number
): RankGroups {
  return groups.map((g, i) => (i === groupIndex ? [...g, courseId] : [...g]));
}

/**
 * The "only one course holds 10.0" guard: a tie is disallowed against the top
 * group of the `liked` band (doc §4 tie exception, §6).
 */
export function isTopLikedGroup(
  groupIndex: number,
  groupCount: number,
  sentiment: Sentiment
): boolean {
  return sentiment === "liked" && groupIndex === groupCount - 1;
}
