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
import { afterEach, expect, test } from "vitest";
import { precommitGate } from "./precommit-gate";

const originalPath = process.env.PATH;
const originalGitEnv = {
  GIT_DIR: process.env.GIT_DIR,
  GIT_WORK_TREE: process.env.GIT_WORK_TREE,
  GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
};
const directories: string[] = [];
afterEach(() => {
  process.env.PATH = originalPath;
  for (const [name, value] of Object.entries(originalGitEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(gate: string) {
  const root = mkdtempSync(join(tmpdir(), "precommit-test-"));
  directories.push(root);
  const git = (...args: readonly string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  git("init", "--quiet");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  writeFileSync(join(root, "source"), "initial");
  git("add", "source");
  git("-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture");
  writeFileSync(join(root, "source"), "staged");
  git("add", "source");
  writeFileSync(join(root, "source"), "unstaged");
  writeFileSync(join(root, "untracked"), "keep");
  const bin = mkdtempSync(join(tmpdir(), "precommit-bin-"));
  directories.push(bin);
  writeFileSync(
    join(bin, "bun"),
    `#!/bin/sh\nset -eu\nif [ "$1" = install ]; then exit 0; fi\n${gate}\n`,
  );
  chmodSync(join(bin, "bun"), 0o755);
  process.env.PATH = `${bin}:${originalPath}`;
  return { root, git };
}

test("tests the index while preserving unstaged and untracked bytes", () => {
  const { root, git } = fixture(`[ "$(cat source)" = staged ]
mkdir .gate
printf evidence > .gate/summary.md`);
  const tree = git("write-tree");
  precommitGate(root);
  expect(readFileSync(join(root, "source"), "utf8")).toBe("unstaged");
  expect(readFileSync(join(root, "untracked"), "utf8")).toBe("keep");
  expect(git("write-tree")).toBe(tree);
  expect(
    readFileSync(join(root, ".gate", "precommit", "summary.md"), "utf8"),
  ).toBe("evidence");
});

test("fails closed when the gate fails", () => {
  const { root } = fixture("exit 7");
  expect(() => precommitGate(root)).toThrow("bun run gate failed");
  expect(readFileSync(join(root, "source"), "utf8")).toBe("unstaged");
});

test("rejects an index changed while testing", () => {
  const { root, git } = fixture(
    'git -C "$(git remote get-url origin)" add source',
  );
  expect(() => precommitGate(root)).toThrow("Index or HEAD changed");
  expect(git("show", ":source")).toBe("unstaged");
});

test("rejects source rewritten by the gate", () => {
  const { root } = fixture("echo modified > source");
  expect(() => precommitGate(root)).toThrow();
  expect(readFileSync(join(root, "source"), "utf8")).toBe("unstaged");
});

test("isolates inherited hook Git variables from the temporary checkout", () => {
  const { root, git } = fixture('[ "$(cat source)" = staged ]');
  const tree = git("write-tree");
  process.env.GIT_DIR = join(root, ".git");
  process.env.GIT_WORK_TREE = root;
  process.env.GIT_INDEX_FILE = join(root, ".git", "index");
  precommitGate(root);
  expect(git("write-tree")).toBe(tree);
  expect(readFileSync(join(root, "source"), "utf8")).toBe("unstaged");
  expect(readFileSync(join(root, "untracked"), "utf8")).toBe("keep");
});
