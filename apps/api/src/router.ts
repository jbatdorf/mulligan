import { router } from "./trpc";
import { userRouter } from "./routers/user";
import { courseRouter } from "./routers/course";
import { ratingRouter } from "./routers/rating";
import { roundRouter } from "./routers/round";
import { feedRouter } from "./routers/feed";
import { postRouter } from "./routers/post";

export const appRouter = router({
  user: userRouter,
  course: courseRouter,
  rating: ratingRouter,
  round: roundRouter,
  feed: feedRouter,
  post: postRouter,
});

export type AppRouter = typeof appRouter;
