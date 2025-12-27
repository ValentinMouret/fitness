import { afterAll } from "vitest";
import { closeConnections } from "./app/db/index";

afterAll(async () => {
  await closeConnections();
});
