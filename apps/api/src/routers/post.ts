import { router, protectedProcedure } from "../trpc";

export const postRouter = router({
  get: protectedProcedure.query(() => {
    // TODO: fetch post with comments and likes
    return null;
  }),
});
