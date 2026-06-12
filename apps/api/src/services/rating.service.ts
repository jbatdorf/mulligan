import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, courses, userCourseRatings, comparisons } from "db";
import type { RatingStepResult, Sentiment } from "schemas";
import { redis } from "../lib/redis";
import { badRequest, notFound } from "../lib/errors";
import {
  type RankGroups,
  bandFor,
  approxInsertionIndex,
  insertGroup,
  isCapped,
  isTopLikedGroup,
  joinGroup,
  nextPivot,
  scoreBand,
} from "./rating-engine";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

interface Logger {
  info(obj: Record<string, unknown>, msg?: string): void;
  debug(obj: Record<string, unknown>, msg?: string): void;
}

const SESSION_TTL_SECONDS = 60 * 60; // 1h (doc §5)
const sessionKey = (userId: string) => `rating:session:${userId}`;

interface AnsweredComparison {
  courseAId: string; // the course being rated
  courseBId: string; // the pivot
  winnerCourseId: string | null;
  tied: boolean;
}

interface RatingSession {
  sessionId: string;
  userId: string;
  courseId: string;
  sentiment: Sentiment;
  bandSnapshot: RankGroups; // target band at start, excluding courseId
  lo: number;
  hi: number;
  answered: AnsweredComparison[];
  createdAt: string;
  courseNames: Record<string, string>;
}

/** Group rows ordered worst→best (score asc) into rank groups of equal score. */
function buildGroups(rows: { courseId: string; score: number }[]): RankGroups {
  const groups: RankGroups = [];
  let prev: number | null = null;
  for (const { courseId, score } of rows) {
    if (prev !== null && score === prev) {
      groups[groups.length - 1].push(courseId);
    } else {
      groups.push([courseId]);
      prev = score;
    }
  }
  return groups;
}

/** Load a user's rated courses in one band as ordered rank groups, excluding `excludeId`. */
async function loadBandGroups(
  client: Db | Tx,
  userId: string,
  sentiment: Sentiment,
  excludeId: string
): Promise<RankGroups> {
  const rows = await client
    .select({
      courseId: userCourseRatings.courseId,
      score: userCourseRatings.score,
    })
    .from(userCourseRatings)
    .where(
      and(
        eq(userCourseRatings.userId, userId),
        eq(userCourseRatings.initialSentiment, sentiment)
      )
    )
    .orderBy(asc(userCourseRatings.score));

  return buildGroups(rows.filter((r) => r.courseId !== excludeId));
}

/** Recompute Course.aggregate_score = AVG(UserCourseRating.score) for the given courses. */
async function recomputeAggregateScores(
  tx: Tx,
  courseIds: string[]
): Promise<void> {
  if (courseIds.length === 0) return;
  await tx
    .update(courses)
    .set({
      aggregateScore: sql`(SELECT AVG(${userCourseRatings.score}) FROM ${userCourseRatings} WHERE ${userCourseRatings.courseId} = ${courses.id})`,
    })
    .where(inArray(courses.id, courseIds));
}

/** Build the final mid-session pair payload from current session state. */
function pairResult(session: RatingSession, pivotCourseId: string): RatingStepResult {
  return {
    done: false,
    sessionId: session.sessionId,
    courseId: session.courseId,
    pivotCourseId,
  };
}

async function writeSession(session: RatingSession): Promise<void> {
  await redis.set(
    sessionKey(session.userId),
    JSON.stringify(session),
    "EX",
    SESSION_TTL_SECONDS
  );
}

/**
 * Commit a completed insertion in a single transaction (doc §7):
 * re-score the target band (and the old band if the sentiment changed), persist
 * the rating, append the comparison log, and recompute affected aggregates.
 */
async function finalize(
  session: RatingSession,
  placement: { insertionIndex: number } | { joinAt: number }
): Promise<RatingStepResult> {
  const { userId, courseId, sentiment, bandSnapshot, answered } = session;

  const newGroups =
    "joinAt" in placement
      ? joinGroup(bandSnapshot, courseId, placement.joinAt)
      : insertGroup(bandSnapshot, courseId, placement.insertionIndex);

  const targetScores = scoreBand(newGroups, bandFor(sentiment));
  const score = targetScores.get(courseId)!;

  const result = await db.transaction(async (tx) => {
    // Detect a re-rate that changed bands → the old band must also be re-scored.
    const [existing] = await tx
      .select({ initialSentiment: userCourseRatings.initialSentiment })
      .from(userCourseRatings)
      .where(
        and(
          eq(userCourseRatings.userId, userId),
          eq(userCourseRatings.courseId, courseId)
        )
      )
      .limit(1);

    const affected = new Set<string>([courseId]);

    // Upsert the rated course.
    await tx
      .insert(userCourseRatings)
      .values({
        userId,
        courseId,
        score,
        initialSentiment: sentiment,
        comparisonCount: answered.length,
      })
      .onConflictDoUpdate({
        target: [userCourseRatings.userId, userCourseRatings.courseId],
        set: {
          score,
          initialSentiment: sentiment,
          comparisonCount: answered.length,
          lastUpdated: new Date(),
        },
      });

    // Re-score the rest of the target band.
    for (const [memberId, memberScore] of targetScores) {
      if (memberId === courseId) continue;
      affected.add(memberId);
      await tx
        .update(userCourseRatings)
        .set({ score: memberScore })
        .where(
          and(
            eq(userCourseRatings.userId, userId),
            eq(userCourseRatings.courseId, memberId)
          )
        );
    }

    // Cross-band re-rate: re-score the old band with the course removed.
    if (existing && existing.initialSentiment !== sentiment) {
      const oldGroups = await loadBandGroups(
        tx,
        userId,
        existing.initialSentiment,
        courseId
      );
      const oldScores = scoreBand(oldGroups, bandFor(existing.initialSentiment));
      for (const [memberId, memberScore] of oldScores) {
        affected.add(memberId);
        await tx
          .update(userCourseRatings)
          .set({ score: memberScore })
          .where(
            and(
              eq(userCourseRatings.userId, userId),
              eq(userCourseRatings.courseId, memberId)
            )
          );
      }
    }

    // Append the buffered comparison log (durable, append-only).
    if (answered.length > 0) {
      await tx.insert(comparisons).values(
        answered.map((a) => ({
          userId,
          courseAId: a.courseAId,
          courseBId: a.courseBId,
          winnerCourseId: a.winnerCourseId,
          tied: a.tied,
        }))
      );
    }

    // Synchronous aggregate recompute (swap for a queue later).
    await recomputeAggregateScores(tx, [...affected]);

    // Overall rank and total across all sentiment bands.
    const [{ above }] = await tx
      .select({ above: sql<number>`count(*)::int` })
      .from(userCourseRatings)
      .where(
        and(
          eq(userCourseRatings.userId, userId),
          sql`${userCourseRatings.score} > ${score}`,
        )
      );
    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(userCourseRatings)
      .where(eq(userCourseRatings.userId, userId));

    return { done: true as const, courseId, score, rank: above + 1, total };
  });

  await redis.del(sessionKey(userId));
  return result;
}

async function logAllRankings(userId: string, log: Logger): Promise<void> {
  const rows = await db
    .select({ name: courses.name, score: userCourseRatings.score, sentiment: userCourseRatings.initialSentiment })
    .from(userCourseRatings)
    .innerJoin(courses, eq(userCourseRatings.courseId, courses.id))
    .where(eq(userCourseRatings.userId, userId))
    .orderBy(desc(userCourseRatings.score));
  log.debug(
    { rankings: rows.map((r, i) => `#${i + 1} ${r.name} (${r.score.toFixed(1)}) [${r.sentiment}]`) },
    "overall rankings"
  );
}

/** rating.cancel — drop any in-progress session so the user isn't locked out. */
export async function cancelSession(userId: string): Promise<{ ok: true }> {
  await redis.del(sessionKey(userId));
  return { ok: true };
}

/** rating.start — open a session and return the first comparison pair (doc §6). */
export async function startSession(
  userId: string,
  courseId: string,
  sentiment: Sentiment,
  log: Logger
): Promise<RatingStepResult> {
  if (await redis.exists(sessionKey(userId))) {
    throw badRequest("You already have a rating in progress");
  }

  const [course] = await db
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) throw notFound("Course not found");

  const bandSnapshot = await loadBandGroups(db, userId, sentiment, courseId);

  const allBandIds = bandSnapshot.flat();
  const nameRows =
    allBandIds.length > 0
      ? await db
          .select({ id: courses.id, name: courses.name })
          .from(courses)
          .where(inArray(courses.id, allBandIds))
      : [];
  const courseNames: Record<string, string> = {
    [courseId]: course.name,
    ...Object.fromEntries(nameRows.map((r) => [r.id, r.name])),
  };

  log.info(
    { course: course.name, sentiment, bandSize: bandSnapshot.length },
    "rating session started"
  );

  const session: RatingSession = {
    sessionId: randomUUID(),
    userId,
    courseId,
    sentiment,
    bandSnapshot,
    lo: 0,
    hi: bandSnapshot.length,
    answered: [],
    createdAt: new Date().toISOString(),
    courseNames,
  };

  // Empty band → no comparisons; the course lands at the band floor (doc §10).
  if (session.lo === session.hi) {
    log.debug({ course: course.name }, "band empty — finalizing at floor");
    const result = await finalize(session, { insertionIndex: session.lo });
    if (result.done) {
      log.info({ course: course.name, score: result.score, rank: result.rank }, "rating finalized");
      await logAllRankings(userId, log);
    }
    return result;
  }

  await writeSession(session);
  const pivot = nextPivot(session.lo, session.hi);
  // pivot is guaranteed not-done here (lo < hi).
  const pivotCourseId =
    session.bandSnapshot[(pivot as { pivotGroupIndex: number }).pivotGroupIndex][0];
  log.debug(
    { rating: course.name, pivot: courseNames[pivotCourseId], lo: session.lo, hi: session.hi },
    "first comparison"
  );
  return pairResult(session, pivotCourseId);
}

/** rating.submitComparison — record an answer, return the next pair or finalize (doc §6). */
export async function submitComparison(
  userId: string,
  input: {
    sessionId: string;
    winnerCourseId: string | null;
    loserCourseId: string | null;
    tied: boolean;
  },
  log: Logger
): Promise<RatingStepResult> {
  const raw = await redis.get(sessionKey(userId));
  if (!raw) throw notFound("No active rating session");

  const session = JSON.parse(raw) as RatingSession;
  if (session.sessionId !== input.sessionId) {
    throw badRequest("Session mismatch");
  }

  const mid = (session.lo + session.hi) >> 1;
  const pivotCourseId = session.bandSnapshot[mid][0];
  const pair = new Set([session.courseId, pivotCourseId]);

  // Validate the answer is against the current pivot.
  for (const id of [input.winnerCourseId, input.loserCourseId]) {
    if (id !== null && !pair.has(id)) {
      throw badRequest("Answer does not match the current comparison");
    }
  }
  if (!input.tied && input.winnerCourseId === null) {
    throw badRequest("A non-tie comparison must have a winner");
  }

  // Tie against the top liked group is rejected — only one course holds 10.0.
  if (
    input.tied &&
    isTopLikedGroup(mid, session.bandSnapshot.length, session.sentiment)
  ) {
    throw badRequest("Only one course can hold 10.0 — pick a winner");
  }

  const outcome = input.tied ? "tied" : input.winnerCourseId === session.courseId ? "win" : "loss";
  log.info(
    {
      rating: session.courseNames[session.courseId],
      pivot: session.courseNames[pivotCourseId],
      outcome,
      step: session.answered.length + 1,
      lo: session.lo,
      hi: session.hi,
    },
    "comparison received"
  );

  session.answered.push({
    courseAId: session.courseId,
    courseBId: pivotCourseId,
    winnerCourseId: input.tied ? null : input.winnerCourseId,
    tied: input.tied,
  });

  if (input.tied) {
    log.debug({ reason: "tied" }, "finalizing");
    const result = await finalize(session, { joinAt: mid });
    if (result.done) {
      log.info(
        { course: session.courseNames[session.courseId], score: result.score, rank: result.rank },
        "rating finalized"
      );
      await logAllRankings(userId, log);
    }
    return result;
  }

  if (outcome === "win") {
    session.lo = mid + 1;
  } else {
    session.hi = mid;
  }

  const pivot = nextPivot(session.lo, session.hi);
  if (pivot.done) {
    log.debug({ reason: "converged", insertionIndex: pivot.insertionIndex }, "finalizing");
    const result = await finalize(session, { insertionIndex: pivot.insertionIndex });
    if (result.done) {
      log.info(
        { course: session.courseNames[session.courseId], score: result.score, rank: result.rank },
        "rating finalized"
      );
      await logAllRankings(userId, log);
    }
    return result;
  }
  if (isCapped(session.answered.length)) {
    const approxIndex = approxInsertionIndex(session.lo, session.hi);
    log.debug({ reason: "capped", approxIndex }, "finalizing");
    const result = await finalize(session, { insertionIndex: approxIndex });
    if (result.done) {
      log.info(
        { course: session.courseNames[session.courseId], score: result.score, rank: result.rank },
        "rating finalized"
      );
      await logAllRankings(userId, log);
    }
    return result;
  }

  await writeSession(session);
  const nextPivotId = session.bandSnapshot[pivot.pivotGroupIndex][0];
  log.debug(
    {
      rating: session.courseNames[session.courseId],
      pivot: session.courseNames[nextPivotId],
      lo: session.lo,
      hi: session.hi,
    },
    "next comparison"
  );
  return pairResult(session, nextPivotId);
}
