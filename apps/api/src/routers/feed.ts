import { router, protectedProcedure } from "../trpc";

export const feedRouter = router({
  list: protectedProcedure.query(() => {
    // TODO: cursor-paginated feed for followed users, excluding hidden posts
    return null;
  }),
});
