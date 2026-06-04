import { router, protectedProcedure } from "../trpc";

export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    // TODO: return ctx.userId's user record
    return null;
  }),
});
