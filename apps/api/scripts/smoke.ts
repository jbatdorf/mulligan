/**
 * Smoke test — runs against a live local server.
 * Usage: dotenv -e ../../.env tsx scripts/smoke.ts <userId> [targetUserId]
 *
 * <userId>       — the viewer (seeded user UUID, used as the bearer token)
 * [targetUserId] — optional second user to test get/followers/following/follow
 *
 * The dev auth stub treats the bearer token as a literal userId.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../src/router";

const [userId, targetUserId] = process.argv.slice(2);
if (!userId) {
  console.error("Usage: tsx scripts/smoke.ts <userId> [targetUserId]");
  process.exit(1);
}

const BASE = `http://localhost:${process.env.PORT ?? 3001}`;

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${BASE}/trpc`,
      headers: { Authorization: `Bearer ${userId}` },
    }),
  ],
});

async function run() {
  console.log(`\n🏌️  mulligan API smoke test`);
  console.log(`   server : ${BASE}`);
  console.log(`   userId : ${userId}`);
  if (targetUserId) console.log(`   target : ${targetUserId}`);
  console.log();

  // /health
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  console.log("✅ GET /health           →", health);

  // user.me
  const me = await client.user.me.query();
  console.log("✅ user.me               →", me);

  // user.get (self)
  const self = await client.user.get.query({ userId });
  console.log("✅ user.get (self)        →", self);

  // user.followers (self)
  const followers = await client.user.followers.query({ userId });
  console.log(`✅ user.followers (self)        → ${followers.length} follower(s)`);

  // user.following (self)
  const following = await client.user.following.query({ userId });
  console.log(`✅ user.following (self)         → ${following.length} following`);

  if (targetUserId) {
    // user.get (other)
    const other = await client.user.get.query({ userId: targetUserId });
    console.log("✅ user.get (other)       →", other);

    // user.follow
    const followed = await client.user.follow.mutate({ userId: targetUserId });
    console.log("✅ user.follow            →", followed);

    // user.unfollow
    const unfollowed = await client.user.unfollow.mutate({ userId: targetUserId });
    console.log("✅ user.unfollow          →", unfollowed);
  }

  // user.update
  const updated = await client.user.update.mutate({ name: me.name });
  console.log("✅ user.update            →", updated);

  // course.search
  const candidates = await client.course.search.query({ query: "pebble beach" });
  console.log(`✅ course.search          → ${candidates.length} candidate(s)`, candidates[0]?.name);

  // course.leaderboard
  const leaderboard = await client.course.leaderboard.query();
  console.log(`✅ course.leaderboard     → ${leaderboard.length} course(s)`);
  if (leaderboard[0]) {
    leaderboard.forEach((c, idx) => {
      console.log(`   #${idx + 1}: ${c.name} — ${c.score}`);
    })
    
  }

  // round.list
  const rounds = await client.round.list.query();
  console.log(`✅ round.list             → ${rounds.length} round(s)`);

  // round.listByCourse (first leaderboard course if any)
  if (leaderboard[0]) {
    const courseRounds = await client.round.listByCourse.query({ courseId: leaderboard[0].id });
    console.log(`✅ round.listByCourse     → ${courseRounds.length} round(s) at ${leaderboard[0].name}`);
  }

  // post — use first round's post if available
  if (rounds[0]) {
    // Get a post ID via round (round.create returns { round, post })
    // Here we use seeded data — grab the first round and find its post via feed stub
    // post.like / unlike
    await client.post.like.mutate({ targetType: "post", targetId: rounds[0].id });
    await client.post.unlike.mutate({ targetType: "post", targetId: rounds[0].id });
    console.log("✅ post.like / unlike    → ok (round id as proxy — real postId needed in prod)");
  }

  // feed.list (page 1)
  const feedPage1 = await client.feed.list.query({});
  console.log(`✅ feed.list (p1)         → ${feedPage1.items.length} post(s), hasMore: ${feedPage1.nextCursor !== null}`);

  // feed.list (page 2 via cursor, if available)
  if (feedPage1.nextCursor) {
    const feedPage2 = await client.feed.list.query({ cursor: feedPage1.nextCursor });
    console.log(`✅ feed.list (p2)         → ${feedPage2.items.length} post(s)`);
  }

  console.log("\n✅ All checks passed\n");
}

run().catch((err) => {
  console.error("\n❌ Smoke test failed:", err.message ?? err);
  process.exit(1);
});
