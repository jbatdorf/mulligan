/**
 * Smoke test — runs against a live local server.
 * Usage: dotenv -e ../../.env tsx scripts/smoke.ts <userId>
 *
 * <userId> can be any UUID from your seeded users table.
 * The dev auth stub treats the bearer token as a literal userId.
 */
import {
  createTRPCClient,
  httpBatchLink,
} from "@trpc/client";
import type { AppRouter } from "../src/router";

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: tsx scripts/smoke.ts <userId>");
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
  console.log(`   userId : ${userId}\n`);

  // /health (plain HTTP, not tRPC)
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  console.log("✅ GET /health       →", health);

  // user.me
  const me = await client.user.me.query();
  console.log("✅ user.me           →", me);

  // feed.list
  const feed = await client.feed.list.query();
  console.log("✅ feed.list         →", feed);

  // course.search
  const courses = await client.course.search.query();
  console.log("✅ course.search     →", courses);

  // rating.start (mutation)
  const ratingStart = await client.rating.start.mutate();
  console.log("✅ rating.start      →", ratingStart);

  // round.create (mutation)
  const round = await client.round.create.mutate();
  console.log("✅ round.create      →", round);

  // post.get
  const post = await client.post.get.query();
  console.log("✅ post.get          →", post);

  console.log("\n✅ All procedures reachable\n");
}

run().catch((err) => {
  console.error("\n❌ Smoke test failed:", err.message ?? err);
  process.exit(1);
});
