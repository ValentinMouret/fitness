import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const hashCredential = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomCredential = async () =>
  randomBytes(32).toString("base64url");
export const credentialsMatch = (actual: string, expected: string) =>
  timingSafeEqual(
    Buffer.from(hashCredential(actual)),
    Buffer.from(hashCredential(expected)),
  );
