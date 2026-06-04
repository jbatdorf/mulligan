import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { faker } from "@faker-js/faker";
import {
  users,
  courses,
  follows,
  userCourseRatings,
  comparisons,
  rounds,
  posts,
  comments,
  likes,
  sentimentEnum,
  likeTargetEnum,
} from "./schema/index.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

// ── helpers ────────────────────────────────────────────────────────────────

const SENTIMENTS = sentimentEnum.enumValues;
const LIKE_TARGETS = likeTargetEnum.enumValues;

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number, decimals = 1) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

const pickRandom = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const pickMultiple = <T>(arr: readonly T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
};

// ── realistic golf data ────────────────────────────────────────────────────

const COURSE_NAMES = [
  "Pebble Beach Golf Links",
  "Augusta National Golf Club",
  "Pinehurst No. 2",
  "Torrey Pines Golf Course",
  "Bethpage Black",
  "TPC Sawgrass",
  "Whistling Straits",
  "Erin Hills",
  "Oakmont Country Club",
  "Shinnecock Hills",
  "The Country Club",
  "Riviera Country Club",
  "Muirfield Village",
  "Hazeltine National",
  "Cherry Hills Country Club",
  "Winged Foot Golf Club",
  "Medinah Country Club",
  "Congressional Country Club",
  "Oakland Hills Country Club",
  "Southern Hills Country Club",
];

// ── wipe ───────────────────────────────────────────────────────────────────

async function wipe() {
  await db.delete(likes);
  await db.delete(comments);
  await db.delete(posts);
  await db.delete(rounds);
  await db.delete(comparisons);
  await db.delete(userCourseRatings);
  await db.delete(follows);
  await db.delete(courses);
  await db.delete(users);
  console.log("🗑️  Wiped existing data");
}

// ── seed ───────────────────────────────────────────────────────────────────

async function seed() {
  await wipe();

  // Users
  const insertedUsers = await db
    .insert(users)
    .values(
      Array.from({ length: 10 }).map(() => ({
        name: faker.person.fullName(),
        email: faker.internet.email(),
        phone: faker.phone.number({ style: "national" }),
        isPrivate: faker.datatype.boolean({ probability: 0.2 }),
      }))
    )
    .returning();
  console.log(`👤 Seeded ${insertedUsers.length} users`);

  // Courses
  const insertedCourses = await db
    .insert(courses)
    .values(
      COURSE_NAMES.map((name) => ({
        name,
        googlePlaceId: faker.string.alphanumeric(27),
        address: faker.location.streetAddress({ useFullAddress: true }),
        lat: parseFloat(faker.location.latitude({ min: 25, max: 48 }).toString()),
        lng: parseFloat(faker.location.longitude({ min: -124, max: -70 }).toString()),
        par: pickRandom([70, 71, 72, 73]),
        slope: randomInt(113, 148),
      }))
    )
    .returning();
  console.log(`⛳ Seeded ${insertedCourses.length} courses`);

  // Follows (each user follows 2–5 others)
  const followPairs = new Set<string>();
  for (const user of insertedUsers) {
    const others = insertedUsers.filter((u) => u.id !== user.id);
    for (const target of pickMultiple(others, randomInt(2, 5))) {
      followPairs.add(`${user.id}:${target.id}`);
    }
  }
  await db.insert(follows).values(
    [...followPairs].map((pair) => {
      const [followerId, followingId] = pair.split(":");
      return { followerId, followingId };
    })
  );
  console.log(`👥 Seeded ${followPairs.size} follows`);

  // Ratings + comparisons (each user rates 4–8 courses)
  const insertedRatings: (typeof userCourseRatings.$inferSelect)[] = [];

  for (const user of insertedUsers) {
    const ratedCourses = pickMultiple(insertedCourses, randomInt(4, 8));

    for (const course of ratedCourses) {
      const [rating] = await db
        .insert(userCourseRatings)
        .values({
          userId: user.id,
          courseId: course.id,
          score: randomFloat(3, 10),
          initialSentiment: pickRandom(SENTIMENTS),
          comparisonCount: randomInt(3, 10),
          photos: Array.from({ length: randomInt(0, 4) }).map(() =>
            faker.image.url({ width: 800, height: 600 })
          ),
        })
        .returning();

      insertedRatings.push(rating);

      // A few comparisons per rating
      const otherCourses = ratedCourses.filter((c) => c.id !== course.id);
      for (const opponent of pickMultiple(otherCourses, randomInt(1, 3))) {
        const tied = faker.datatype.boolean({ probability: 0.1 });
        const courseAWins = faker.datatype.boolean();
        await db.insert(comparisons).values({
          userId: user.id,
          courseAId: course.id,
          courseBId: opponent.id,
          winnerCourseId: tied ? null : courseAWins ? course.id : opponent.id,
          tied,
        });
      }
    }
  }
  console.log(`⭐ Seeded ${insertedRatings.length} ratings`);

  // Rounds + posts (each rating gets 1–3 rounds)
  const insertedPosts: (typeof posts.$inferSelect)[] = [];

  for (const rating of insertedRatings) {
    const roundCount = randomInt(1, 3);

    for (let i = 0; i < roundCount; i++) {
      const [round] = await db
        .insert(rounds)
        .values({
          userId: rating.userId,
          courseId: rating.courseId,
          score: randomInt(72, 105),
          playedAt: faker.date.recent({ days: 365 }).toISOString().split("T")[0],
        })
        .returning();

      const [post] = await db
        .insert(posts)
        .values({
          userId: rating.userId,
          courseId: rating.courseId,
          roundId: round.id,
          ratingId: rating.id,
          notes: faker.datatype.boolean({ probability: 0.6 })
            ? faker.lorem.sentences(randomInt(1, 3))
            : null,
          hidden: faker.datatype.boolean({ probability: 0.1 }),
        })
        .returning();

      insertedPosts.push(post);
    }
  }
  console.log(`📝 Seeded ${insertedPosts.length} posts`);

  // Comments (some posts get 0–4 comments)
  const insertedComments: (typeof comments.$inferSelect)[] = [];

  for (const post of insertedPosts) {
    const commentCount = randomInt(0, 4);
    for (let i = 0; i < commentCount; i++) {
      const [comment] = await db
        .insert(comments)
        .values({
          userId: pickRandom(insertedUsers).id,
          postId: post.id,
          parentId: null,
          text: faker.lorem.sentences(randomInt(1, 2)),
        })
        .returning();
      insertedComments.push(comment);
    }
  }
  console.log(`💬 Seeded ${insertedComments.length} comments`);

  // Likes (spread across posts and comments)
  const likeSet = new Set<string>();

  for (const user of insertedUsers) {
    for (const post of pickMultiple(insertedPosts, randomInt(3, 10))) {
      likeSet.add(`${user.id}:post:${post.id}`);
    }
    for (const comment of pickMultiple(insertedComments, randomInt(0, 5))) {
      likeSet.add(`${user.id}:comment:${comment.id}`);
    }
  }

  await db.insert(likes).values(
    [...likeSet].map((key) => {
      const [userId, targetType, targetId] = key.split(":");
      return {
        userId,
        targetType: targetType as "post" | "comment",
        targetId,
      };
    })
  );
  console.log(`❤️  Seeded ${likeSet.size} likes`);

  console.log("\n✅ Seed complete");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
