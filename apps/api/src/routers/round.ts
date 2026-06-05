import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const roundRouter = router({
  create: protectedProcedure.input(z.void()).mutation(() => {
    // TODO: insert Round + auto-create Post in one transaction
    return null;
  }),
});
