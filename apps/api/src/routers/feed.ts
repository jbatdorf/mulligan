import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const feedRouter = router({
  list: protectedProcedure.input(z.void()).query(() => {
    // TODO: cursor-paginated feed for followed users, excluding hidden posts
    return null;
  }),
});
