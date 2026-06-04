import { router, protectedProcedure } from "../trpc";

export const courseRouter = router({
  search: protectedProcedure.query(() => {
    // TODO: Google Places lookup + course upsert-on-first-rating
    return null;
  }),
});
