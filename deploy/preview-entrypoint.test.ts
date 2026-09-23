import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function runEntrypoint(mcpDatabaseUrl?: string) {
  const directory = mkdtempSync(join(tmpdir(), "fitness-entrypoint-"));
  directories.push(directory);
  const callsFile = join(directory, "calls");
  const bun = join(directory, "bun");
  writeFileSync(bun, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS_FILE"\n');
  chmodSync(bun, 0o755);
  execFileSync(
    "sh",
    [join(import.meta.dirname, "preview-entrypoint.sh"), "true"],
    {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH ?? ""}`,
        CALLS_FILE: callsFile,
        PREVIEW_APP: "false",
        REVIEW_DATABASE_RUN_SEED: "false",
        MCP_DATABASE_URL: mcpDatabaseUrl ?? "",
      },
    },
  );
  return readFileSync(callsFile, "utf8").trim().split("\n");
}

describe("production entrypoint", () => {
  it("provisions the MCP reader after migrations when configured", () => {
    expect(
      runEntrypoint("postgresql://fitness_mcp_reader:secret@localhost/fitness"),
    ).toEqual(["app/db/migrate.ts", "scripts/provision-mcp-reader.ts"]);
  });

  it("skips reader provisioning when MCP reads are disabled", () => {
    expect(runEntrypoint()).toEqual(["app/db/migrate.ts"]);
  });
});
