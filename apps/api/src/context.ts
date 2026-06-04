import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { db } from "db";
import { stubAuthProvider } from "./lib/auth";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = await stubAuthProvider.verify(token);
  return { db, userId: user?.userId ?? null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
