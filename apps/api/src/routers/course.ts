import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const courseRouter = router({
  search: protectedProcedure.input(z.void()).query(() => {
    // TODO: Google Places lookup + course upsert-on-first-rating
    return null;
  }),
});
