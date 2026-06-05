import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const userRouter = router({
  me: protectedProcedure.input(z.void()).query(({ ctx }) => {
    // TODO: return ctx.userId's user record
    return null;
  }),
});
