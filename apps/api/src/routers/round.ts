import { router, protectedProcedure } from "../trpc";

export const roundRouter = router({
  create: protectedProcedure.mutation(() => {
    // TODO: insert Round + auto-create Post in one transaction
    return null;
  }),
});
