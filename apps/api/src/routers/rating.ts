import { router, protectedProcedure } from "../trpc";

export const ratingRouter = router({
  start: protectedProcedure.mutation(() => {
    // TODO: open comparison session, return first pair
    return null;
  }),
});
