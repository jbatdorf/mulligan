import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const ratingRouter = router({
  start: protectedProcedure.input(z.void()).mutation(() => {
    // TODO: open comparison session, return first pair
    return null;
  }),
});
