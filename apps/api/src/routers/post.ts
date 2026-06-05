import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const postRouter = router({
  get: protectedProcedure.input(z.void()).query(() => {
    // TODO: fetch post with comments and likes
    return null;
  }),
});
