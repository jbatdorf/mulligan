import { describe, expect, it } from "vitest";
import {
  type Outcome,
  type RankGroups,
  approxInsertionIndex,
  bandFor,
  insertGroup,
  isCapped,
  isTopLikedGroup,
  joinGroup,
  nextPivot,
  scoreBand,
} from "./rating-engine";

const LIKED = bandFor("liked");
const DISLIKED = bandFor("disliked");

/**
 * Drive the binary-search insertion to completion using a fixed list of
 * outcomes (X vs. each pivot), returning the resulting rank groups.
 */
function runInsertion(
  groups: RankGroups,
  x: string,
  outcomes: Outcome[]
): RankGroups {
  let lo = 0;
  let hi = groups.length;
  for (const outcome of outcomes) {
    const mid = (lo + hi) >> 1;
    if (outcome === "tie") return joinGroup(groups, x, mid);
    if (outcome === "win") lo = mid + 1;
    else hi = mid;
    if (lo >= hi) break;
  }
  return insertGroup(groups, x, lo);
}

describe("scoreBand — liked band [6.7, 10.0]", () => {
  it("g=1 → single group pinned to lo", () => {
    expect(scoreBand([["A"]], LIKED).get("A")).toBe(6.7);
  });

  it("g=2 → endpoints 6.7 and 10.0", () => {
    const s = scoreBand([["A"], ["B"]], LIKED);
    expect(s.get("A")).toBe(6.7);
    expect(s.get("B")).toBe(10.0);
  });

  it("g=3 → 6.7, 8.4, 10.0 (doc worked example)", () => {
    const s = scoreBand([["A"], ["B"], ["C"]], LIKED);
    expect(s.get("A")).toBe(6.7);
    expect(s.get("B")).toBe(8.4);
    expect(s.get("C")).toBe(10.0);
  });

  it("ties share a group score — [[A,B],[C]]", () => {
    const s = scoreBand([["A", "B"], ["C"]], LIKED);
    expect(s.get("A")).toBe(6.7);
    expect(s.get("B")).toBe(6.7);
    expect(s.get("C")).toBe(10.0);
  });
});

describe("band edges are live values", () => {
  it("top of liked is always exactly 10.0", () => {
    const s = scoreBand([["A"], ["B"], ["C"], ["D"]], LIKED);
    expect(s.get("D")).toBe(10.0);
  });

  it("bottom of disliked is always exactly 0.0", () => {
    const s = scoreBand([["A"], ["B"]], DISLIKED);
    expect(s.get("A")).toBe(0.0);
    expect(s.get("B")).toBe(3.3);
  });
});

describe("binary insertion sanity trace — groups=[[A],[B]], insert X", () => {
  const base: RankGroups = [["A"], ["B"]];

  it("X beats B → [[A],[B],[X]]", () => {
    expect(runInsertion(base, "X", ["win"])).toEqual([["A"], ["B"], ["X"]]);
  });

  it("X ties B → [[A],[B,X]]", () => {
    expect(runInsertion(base, "X", ["tie"])).toEqual([["A"], ["B", "X"]]);
  });

  it("X loses B, beats A → [[A],[X],[B]]", () => {
    expect(runInsertion(base, "X", ["loss", "win"])).toEqual([
      ["A"],
      ["X"],
      ["B"],
    ]);
  });

  it("X loses B, ties A → [[A,X],[B]]", () => {
    expect(runInsertion(base, "X", ["loss", "tie"])).toEqual([
      ["A", "X"],
      ["B"],
    ]);
  });

  it("X loses B, loses A → [[X],[A],[B]]", () => {
    expect(runInsertion(base, "X", ["loss", "loss"])).toEqual([
      ["X"],
      ["A"],
      ["B"],
    ]);
  });
});

describe("nextPivot", () => {
  it("returns the midpoint group while lo < hi", () => {
    expect(nextPivot(0, 4)).toEqual({ done: false, pivotGroupIndex: 2 });
  });

  it("is done when lo === hi, exposing the insertion index", () => {
    expect(nextPivot(3, 3)).toEqual({ done: true, insertionIndex: 3 });
  });
});

describe("cap behaviour", () => {
  it("isCapped triggers at the default CAP of 5", () => {
    expect(isCapped(4)).toBe(false);
    expect(isCapped(5)).toBe(true);
  });

  it("approxInsertionIndex picks the remaining-range midpoint", () => {
    expect(approxInsertionIndex(2, 7)).toBe(4);
  });
});

describe("isTopLikedGroup — only one course holds 10.0", () => {
  it("rejects a tie against the top group of a liked band", () => {
    expect(isTopLikedGroup(2, 3, "liked")).toBe(true);
  });

  it("allows ties below the top liked group", () => {
    expect(isTopLikedGroup(1, 3, "liked")).toBe(false);
  });

  it("allows ties in non-liked bands", () => {
    expect(isTopLikedGroup(2, 3, "fine")).toBe(false);
    expect(isTopLikedGroup(1, 2, "disliked")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant: exactly one course holds the band ceiling (10.0) after insertion
// ---------------------------------------------------------------------------

/** Count entries in a score map that equal exactly `value`. */
function countAt(scores: Map<string, number>, value: number): number {
  return [...scores.values()].filter((s) => s === value).length;
}

describe("ceiling invariant — at most one course holds hi=10.0 after insertion", () => {
  it("sole new top (2 existing → 3 groups): only X at 10.0", () => {
    // Before insertion: [[A],[B]], B was top at 10.0.
    // X beats B (the top pivot) → insertionIndex=2.
    const base: RankGroups = [["A"], ["B"]];
    const result = runInsertion(base, "X", ["win"]);
    // expected: [[A],[B],[X]]
    expect(result).toEqual([["A"], ["B"], ["X"]]);
    const scores = scoreBand(result, LIKED);
    expect(countAt(scores, 10.0)).toBe(1);
    expect(scores.get("X")).toBe(10.0);
    expect(scores.get("B")).toBeLessThan(10.0);
  });

  it("sole new top (4 existing → 5 groups): only X at 10.0, old top re-scored below", () => {
    // Mirrors the reported repro: 4 liked courses, Medinah was top at 10.0.
    // X wins both comparisons (against group[2] then group[3]=Medinah).
    const base: RankGroups = [["A"], ["B"], ["C"], ["Medinah"]];
    const result = runInsertion(base, "X", ["win", "win"]);
    // Binary search: lo=0,hi=4 → mid=2 win → lo=3; mid=3 win → lo=4, done → insert at 4.
    expect(result).toEqual([["A"], ["B"], ["C"], ["Medinah"], ["X"]]);
    const scores = scoreBand(result, LIKED);
    expect(countAt(scores, 10.0)).toBe(1);
    expect(scores.get("X")).toBe(10.0);
    expect(scores.get("Medinah")).toBeLessThan(10.0);
  });

  it("new top above a tied top group (both former tops re-scored below 10.0)", () => {
    // Two courses were tied at the top of the liked band.
    const base: RankGroups = [["A"], ["P", "Q"]];
    const result = runInsertion(base, "X", ["win"]);
    // X beats the top group → insert at 2: [[A],[P,Q],[X]]
    expect(result).toEqual([["A"], ["P", "Q"], ["X"]]);
    const scores = scoreBand(result, LIKED);
    expect(countAt(scores, 10.0)).toBe(1);
    expect(scores.get("X")).toBe(10.0);
    expect(scores.get("P")).toBeLessThan(10.0);
    expect(scores.get("Q")).toBeLessThan(10.0);
  });

  it("new top in a single-entry liked band: only X at 10.0 (prior sole course drops to lo)", () => {
    // One existing liked course (currently at lo because g=1).
    // X beats it → insert above it.
    const base: RankGroups = [["Solo"]];
    const result = runInsertion(base, "X", ["win"]);
    expect(result).toEqual([["Solo"], ["X"]]);
    const scores = scoreBand(result, LIKED);
    expect(countAt(scores, 10.0)).toBe(1);
    expect(scores.get("X")).toBe(10.0);
  });

  it("new course NOT at top: the original top keeps 10.0 (exactly one at ceiling)", () => {
    // X loses to the pivot and ends up in the middle, not at the top.
    const base: RankGroups = [["A"], ["B"], ["Top"]];
    const result = runInsertion(base, "X", ["loss", "win"]);
    // lo=0,hi=3 → mid=1, loss → hi=1; mid=0, win → lo=1, done → insert at 1.
    expect(result).toEqual([["A"], ["X"], ["B"], ["Top"]]);
    const scores = scoreBand(result, LIKED);
    expect(countAt(scores, 10.0)).toBe(1);
    expect(scores.get("Top")).toBe(10.0);
    expect(scores.get("X")).toBeLessThan(10.0);
  });
});
