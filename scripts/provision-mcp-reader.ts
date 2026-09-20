import { env } from "../app/env.server";
import { logger } from "../app/logger.server";
import { provisionReader } from "../app/modules/mcp/infra/provision-reader.server";

if (!env.MCP_DATABASE_URL)
  throw new Error("Set MCP_DATABASE_URL before provisioning the reader");
await provisionReader(env.DATABASE_URL, env.MCP_DATABASE_URL);
logger.info("MCP reader provisioned");
