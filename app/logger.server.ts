import pino from "pino";
import { env } from "./env.server";

const isDev = env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true },
      }
    : undefined,
});
