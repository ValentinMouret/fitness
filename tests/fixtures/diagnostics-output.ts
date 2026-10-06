import { logger } from "../../app/logger.server";

for (let index = 0; index < 5000; index++) {
  logger.error(
    { err: new Error("synthetic private canary") },
    "synthetic private canary",
  );
}
