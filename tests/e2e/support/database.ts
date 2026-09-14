import { Client } from "pg";
import { z } from "zod";

const identifier = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/, "Use schema.table");

export function storageSettings() {
  return z
    .object({
      E2E_DATABASE_URL: z.string().min(1),
      E2E_CONNECTIONS_TABLE: identifier,
      E2E_AUTHORIZATION_CODES_TABLE: identifier,
      E2E_TOKENS_TABLE: identifier,
    })
    .parse(process.env);
}

export async function snapshot(table: string): Promise<readonly unknown[]> {
  const settings = storageSettings();
  const quotedTable = identifier
    .parse(table)
    .split(".")
    .map((part) => `"${part}"`)
    .join(".");
  const client = new Client({ connectionString: settings.E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin read only");
    const result = await client.query<{ record: unknown }>(
      `select to_jsonb(record) as record from ${quotedTable} as record`,
    );
    return result.rows.map(({ record }) => record);
  } finally {
    await client.end();
  }
}
