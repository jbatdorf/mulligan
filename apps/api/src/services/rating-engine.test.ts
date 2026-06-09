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
