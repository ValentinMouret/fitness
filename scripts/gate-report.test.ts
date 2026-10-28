import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { gateSource, writeGateReport } from "./gate-report";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function repository() {
  const root = mkdtempSync(join(tmpdir(), "fitness-report-"));
  directories.push(root);
  const git = (...args: readonly string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "--quiet");
  writeFileSync(join(root, ".gitignore"), ".gate/\n");
  writeFileSync(join(root, "source"), "initial");
  git("add", ".");
  git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "user.name=Test",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  const directory = join(root, ".gate");
  mkdirSync(directory);
  return { root, directory, git };
}

test("source metadata distinguishes staged, unstaged and untracked bytes", () => {
  const { root, git } = repository();
  const initial = gateSource(root);
  writeFileSync(join(root, "source"), "staged");
  git("add", "source");
  expect(gateSource(root)).toEqual({
    ...initial,
    indexTree: git("write-tree"),
  });
  expect(gateSource(root).indexTree).not.toBe(initial.indexTree);
  writeFileSync(join(root, "source"), "unstaged");
  writeFileSync(join(root, "untracked"), "private");
  expect(gateSource(root)).toMatchObject({
    trackedFilesMatchIndex: false,
    untrackedFilesPresent: true,
  });
});

test("failure summary links existing evidence without copying payloads or following symlinks", () => {
  const { root, directory } = repository();
  const result = {
    name: "e2e",
    ok: false,
    seconds: 1.234,
    secret: "do-not-copy",
  };
  const source = { ...gateSource(root), secret: "do-not-copy" };
  const failure = join(directory, "e2e-results", "error [case]");
  mkdirSync(failure, { recursive: true });
  for (const file of [
    "trace.zip",
    "error-context.md",
    "failure.png",
    "inbox.jsonl",
  ])
    writeFileSync(join(failure, file), "do-not-copy");
  writeFileSync(join(directory, "e2e.log"), "do-not-copy");
  mkdirSync(join(directory, "e2e-report"));
  writeFileSync(join(directory, "e2e-report", "index.html"), "do-not-copy");
  symlinkSync(root, join(failure, "external"), "dir");
  symlinkSync(root, join(directory, "native-results"), "dir");
  const report = writeGateReport({
    directory,
    source,
    ok: false,
    seconds: 2,
    results: [result, { name: "native", ok: false, seconds: 0 }],
  });
  expect(report.steps[0].evidence).toEqual([
    "e2e-report/index.html",
    "e2e-results/error [case]/error-context.md",
    "e2e-results/error [case]/failure.png",
    "e2e-results/error [case]/trace.zip",
  ]);
  expect(report.steps[1]).toMatchObject({ log: null, evidence: [] });
  const json = readFileSync(join(directory, "summary.json"), "utf8");
  const markdown = readFileSync(join(directory, "summary.md"), "utf8");
  for (const content of [json, markdown]) {
    expect(content).not.toContain("do-not-copy");
    expect(content).not.toContain("inbox.jsonl");
    expect(content).toContain("bun run gate");
    expect(content).toContain(source.indexTree);
  }
  expect(markdown).toContain("error%20%5Bcase%5D/trace.zip");
});

test("orchestration failure is reported even when no step failed", () => {
  const { root, directory } = repository();
  const report = writeGateReport({
    directory,
    source: gateSource(root),
    ok: false,
    seconds: 0,
    results: [],
  });
  expect(report.ok).toBe(false);
  expect(readFileSync(join(directory, "summary.md"), "utf8")).toContain(
    "Gate setup or orchestration failed",
  );
});
