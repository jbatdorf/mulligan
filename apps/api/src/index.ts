import Fastify from "fastify";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import { appRouter } from "./router";
import { createContext } from "./context";
import type { AppRouter } from "./router";

const isDev = process.env.NODE_ENV !== "production";
const app = Fastify({
  logger: isDev
    ? {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : true,
});

app.get("/health", async () => ({ status: "ok" }));

await app.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        app.log.error(error);
      }
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
