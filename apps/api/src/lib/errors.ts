import { TRPCError } from "@trpc/server";

export const notFound = (message?: string) =>
  new TRPCError({ code: "NOT_FOUND", message });

export const forbidden = (message?: string) =>
  new TRPCError({ code: "FORBIDDEN", message });

export const badRequest = (message?: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
