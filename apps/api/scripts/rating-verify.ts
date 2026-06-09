/* eslint-disable no-console */
/**
 * End-to-end verification for the rating flow — drives the service layer against
 * live Postgres + Redis with throwaway data, then cleans up.
 * Usage: dotenv -e ../../.env tsx scripts/rating-verify.ts
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, users, courses, userCourseRatings, comparisons } from "db";
import { redis } from "../src/lib/redis";
import { startSession, submitComparison } from "../src/services/rating.service";

const userId = randomUUID();
const courseIds: string[] = [];

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`✅ ${label}`);
  } else {
    failures++;
    console.error(`❌ ${label}`, detail ?? "");
  }
}

async function mkCourse(name: string): Promise<string> {
  const [c] = await db
    .insert(courses)
    .values({
      googlePlaceId: `verify-${randomUUID()}`,
      name,
      address: "123 Test Dr",
      lat: 0,
      lng: 0,
    })
    .returning({ id: courses.id });
  courseIds.push(c.id);
  return c.id;
}

async function scoreOf(courseId: string): Promise<number | undefined> {
  const [r] = await db
    .select({ score: userCourseRatings.score })
    .from(userCourseRatings)
    .where(
      and(
        eq(userCourseRatings.userId, userId),
        eq(userCourseRatings.courseId, courseId)
      )
    )
    .limit(1);
  return r?.score;
}

async function run() {
  await db.insert(users).values({ id: userId, name: "Rating Verify" });
  const a = await mkCourse("Course A");
  const b = await mkCourse("Course B");
  const c = await mkCourse("Course C");

  // 1. First liked course → empty band → immediate finalize at floor 6.7.
  const r1 = await startSession(userId, a, "liked");
  check("first liked course finalizes with 0 comparisons", r1.done === true, r1);
  check("first liked course scores 6.7", r1.done && r1.score === 6.7, r1);

  // 2. Rate B liked, beat A → B=10.0, A=6.7.
  const r2start = await startSession(userId, b, "liked");
  check("second course returns a pair", r2start.done === false, r2start);
  if (r2start.done === false) {
    const r2 = await submitComparison(userId, {
      sessionId: r2start.sessionId,
      winnerCourseId: b,
      loserCourseId: a,
      tied: false,
    });
    check("B beats A → B=10.0", r2.done && r2.score === 10.0, r2);
    check("A re-scored to 6.7", (await scoreOf(a)) === 6.7, await scoreOf(a));
  }

  // 3. Concurrent session rejected while one is open.
  const s3 = await startSession(userId, c, "liked");
  check("third course returns a pair", s3.done === false, s3);
  if (s3.done === false) {
    let rejected = false;
    try {
      await startSession(userId, c, "liked");
    } catch {
      rejected = true;
    }
    check("second concurrent start rejected", rejected);

    // Resolve C: pivot is mid of [A,B]; lose first, then settle so C is middle.
    let step = s3 as { done: false; sessionId: string; pivotCourseId: string };
    // C loses to its pivot, then beats the next → lands between A and B.
    const next = await submitComparison(userId, {
      sessionId: step.sessionId,
      winnerCourseId: step.pivotCourseId,
      loserCourseId: c,
      tied: false,
    });
    let cScore: number | undefined;
    if (next.done) {
      cScore = next.score;
    } else {
      const fin = await submitComparison(userId, {
        sessionId: next.sessionId,
        winnerCourseId: c,
        loserCourseId: next.pivotCourseId,
        tied: false,
      });
      cScore = fin.done ? fin.score : undefined;
    }
    check(
      "C lands inside the liked band (6.7–10.0)",
      cScore !== undefined && cScore >= 6.7 && cScore <= 10.0,
      cScore
    );
  }

  // 4. Comparison log persisted.
  const log = await db
    .select()
    .from(comparisons)
    .where(eq(comparisons.userId, userId));
  check("comparison rows persisted", log.length >= 2, log.length);

  // 5. aggregate_score recomputed for course B.
  const [bCourse] = await db
    .select({ agg: courses.aggregateScore })
    .from(courses)
    .where(eq(courses.id, b));
  check("aggregate_score computed for B", bCourse.agg !== null, bCourse.agg);

  // 6. Re-rate A across bands: liked → disliked. A leaves liked band.
  const reA = await startSession(userId, a, "disliked");
  const reAScore = reA.done ? reA.score : undefined;
  check("re-rate A into disliked band → score in [0,3.3]", reAScore === 0.0, reAScore);
  const aSent = (
    await db
      .select({ s: userCourseRatings.initialSentiment })
      .from(userCourseRatings)
      .where(
        and(eq(userCourseRatings.userId, userId), eq(userCourseRatings.courseId, a))
      )
  )[0];
  check("A sentiment updated to disliked", aSent?.s === "disliked", aSent);
}

async function cleanup() {
  await redis.del(`rating:session:${userId}`);
  await db.delete(users).where(eq(users.id, userId)); // cascades ratings/comparisons
  if (courseIds.length) {
    await db.delete(courses).where(inArray(courses.id, courseIds));
  }
}

run()
  .catch((e) => {
    failures++;
    console.error("💥 run threw:", e);
  })
  .finally(async () => {
    await cleanup();
    await redis.quit();
    console.log(failures === 0 ? "\n🎉 all checks passed" : `\n⚠️  ${failures} check(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
  });
