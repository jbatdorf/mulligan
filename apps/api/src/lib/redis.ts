import Redis from "ioredis";

// Singleton Redis client. Backs transient rating sessions (see rating.service.ts).
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
